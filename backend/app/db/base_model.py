"""Shared columns for every table: UUID pk, status, timestamps, soft delete, audit."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.enums import Status


def enum_column(enum_cls: type[enum.Enum]) -> Enum:
    """Portable enum stored as a short string (no native DB enum type to migrate)."""
    return Enum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda e: [m.value for m in e],
    )


def active_unique_index(name: str, *columns: str) -> Index:
    """Unique only among non-deleted rows, so soft-deleted values can be reused."""
    where = text("deleted_at IS NULL")
    return Index(name, *columns, unique=True, postgresql_where=where, sqlite_where=where)


class BaseEntity(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        default=Status.ACTIVE,
        server_default=Status.ACTIVE.value,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
