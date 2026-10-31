from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.enums import Status, UserRole
from app.schemas.base import AuditRead


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    role: UserRole = UserRole.USER
    status: Status = Status.ACTIVE

    @field_validator("username", "email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=64)
    role: UserRole | None = None
    status: Status | None = None

    @field_validator("username", "email")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else v


class UserRead(AuditRead):
    name: str
    username: str
    email: EmailStr
    role: UserRole
