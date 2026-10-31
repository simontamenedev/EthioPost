import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import bad_request, get_or_404
from app.core.enums import Status, UserRole
from app.core.security import hash_password
from app.crud import user_crud
from app.models import User
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: UserRole | None = None,
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search name, username or email"),
) -> list[User]:
    conditions = []
    if role:
        conditions.append(User.role == role)
    if status_:
        conditions.append(User.status == status_)
    if q:
        like = f"%{q}%"
        conditions.append(User.name.ilike(like) | User.username.ilike(like) | User.email.ilike(like))
    return user_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: uuid.UUID, db: DbSession, _: CurrentUser) -> User:
    return get_or_404(user_crud, db, user_id, "User")


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, admin: AdminUser) -> User:
    data = payload.model_dump(exclude={"password"})
    data["hashed_password"] = hash_password(payload.password)
    return user_crud.create(db, data, actor_id=admin.id)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: uuid.UUID, payload: UserUpdate, db: DbSession, admin: AdminUser) -> User:
    user = get_or_404(user_crud, db, user_id, "User")
    data = payload.model_dump(exclude_unset=True, exclude={"password"})
    if payload.password:
        data["hashed_password"] = hash_password(payload.password)
    return user_crud.update(db, user, data, actor_id=admin.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    if user_id == admin.id:
        raise bad_request("You cannot delete your own account")
    user = get_or_404(user_crud, db, user_id, "User")
    user_crud.soft_delete(db, user, actor_id=admin.id)
