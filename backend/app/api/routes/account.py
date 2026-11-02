import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, status
from sqlalchemy import func, select, update

from app.api.deps import CurrentUser, DbSession
from app.api.utils import bad_request
from app.core.config import settings
from app.core.enums import Status
from app.core.security import hash_password, verify_password
from app.crud import user_crud
from app.models import PasswordResetToken, User
from app.schemas.password import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    MessageResponse,
    ProfileUpdate,
    ResetPasswordRequest,
)
from app.schemas.user import UserRead
from app.services.email import send_password_changed_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["account"])

ACTIVE = Status("active")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, background: BackgroundTasks, db: DbSession):
    """Always answers the same way, so it can't be used to discover which emails exist."""
    user = db.scalars(
        select(User).where(
            func.lower(User.email) == payload.email.lower(),
            User.deleted_at.is_(None),
            User.status == ACTIVE,
        )
    ).first()

    if user:
        now = datetime.now(UTC)
        raw = secrets.token_urlsafe(32)
        # only the newest link works
        db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
        )
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=_hash(raw),
                expires_at=now + timedelta(minutes=settings.reset_token_expire_minutes),
                created_by=user.id,
                updated_by=user.id,
            )
        )
        db.commit()
        link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw}"
        background.add_task(send_password_reset_email, user.email, user.name, link)

    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, background: BackgroundTasks, db: DbSession):
    now = datetime.now(UTC)
    record = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash(payload.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.deleted_at.is_(None),
        )
    ).first()
    if not record or _aware(record.expires_at) < now:
        raise bad_request("This reset link is invalid or has expired")

    user = user_crud.get(db, record.user_id)
    if not user or user.status != ACTIVE:
        raise bad_request("This reset link is invalid or has expired")

    # burn this token and any other open ones, committed together with the new password
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    user_crud.update(db, user, {"hashed_password": hash_password(payload.new_password)}, actor_id=user.id)

    background.add_task(send_password_changed_email, user.email, user.name)
    return MessageResponse(message="Password updated. You can now sign in.")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest, background: BackgroundTasks, db: DbSession, user: CurrentUser
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise bad_request("Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise bad_request("New password must be different from the current one")

    user_crud.update(db, user, {"hashed_password": hash_password(payload.new_password)}, actor_id=user.id)
    background.add_task(send_password_changed_email, user.email, user.name)
    return MessageResponse(message="Password changed")


@router.patch("/me", response_model=UserRead)
def update_me(payload: ProfileUpdate, db: DbSession, user: CurrentUser):
    """Users can edit only their own name; role/email/status stay admin-only via /users."""
    return user_crud.update(db, user, {"name": payload.name.strip()}, actor_id=user.id)