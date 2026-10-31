from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, status
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession
from app.core.enums import Status
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas.auth import Token
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _find_user(db: DbSession, email_value: str, username_value: str) -> User | None:
    """Email wins when given; otherwise the username field matches a username or an email.
    (Swagger pre-fills unused fields with "string", so a stray value must not block a valid email.)"""
    user_name = func.lower(User.username)
    user_email = func.lower(User.email)
    live = User.deleted_at.is_(None)

    if email_value:
        user = db.scalars(select(User).where(user_email == email_value, live)).first()
        if user:
            return user
    if username_value:
        return db.scalars(select(User).where(or_(user_name == username_value, user_email == username_value), live)).first()
    return None


@router.post("/login", response_model=Token)
def login(
    db: DbSession,
    password: Annotated[str, Form(description="Account password")],
    email: Annotated[str | None, Form(description="Email address")] = None,
    username: Annotated[str | None, Form(description="Username (an email is accepted here too)")] = None,
) -> Token:
    """Sign in with **email** or **username**, plus password."""
    email_value = (email or "").strip().lower()
    username_value = (username or "").strip().lower()

    if not email_value and not username_value:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Provide an email or a username")

    user = _find_user(db, email_value, username_value)

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status != Status.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserRead)
def read_me(current_user: CurrentUser) -> User:
    return current_user