from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index, enum_column
from app.core.enums import UserRole


class User(BaseEntity):
    __tablename__ = "users"
    __table_args__ = (
        active_unique_index("uq_users_username_active", "username"),
        active_unique_index("uq_users_email_active", "email"),
    )

    name: Mapped[str] = mapped_column(String(150))
    username: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        enum_column(UserRole), default=UserRole.USER, server_default=UserRole.USER.value
    )
    hashed_password: Mapped[str] = mapped_column(String(255))
