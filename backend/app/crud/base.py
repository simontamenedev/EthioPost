
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.base import ExecutableOption

from app.core.enums import AuditAction
from app.crud.audit import record_audit, snapshot
from app.db.base_model import BaseEntity


ModelT = TypeVar("ModelT", bound=BaseEntity)


class CRUDBase(Generic[ModelT]):
    """
    Generic data-access layer.

    - Reads hide soft-deleted rows.
    - Deletes are soft deletes.
    - Writes are audited unless audited=False
      (used for the audit log itself).
    """

    def __init__(
        self,
        model: type[ModelT],
        *,
        audited: bool = True,
    ) -> None:
        self.model = model
        self.audited = audited

    def get(
        self,
        db: Session,
        obj_id: uuid.UUID,
    ) -> ModelT | None:
        stmt = (
            select(self.model)
            .where(
                self.model.id == obj_id,
                self.model.deleted_at.is_(None),
            )
        )

        return db.scalars(stmt).first()

    def get_multi(
        self,
        db: Session,
        *conditions: ColumnElement[bool],
        skip: int = 0,
        limit: int = 50,
        options: Sequence[ExecutableOption] = (),
    ) -> list[ModelT]:
        stmt = (
            select(self.model)
            .where(
                self.model.deleted_at.is_(None),
                *conditions,
            )
            .order_by(
                self.model.created_at.desc(),
                self.model.id,
            )
            .offset(skip)
            .limit(limit)
        )

        if options:
            stmt = stmt.options(*options)

        return list(db.scalars(stmt))

    def count(
        self,
        db: Session,
        *conditions: ColumnElement[bool],
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(self.model)
            .where(
                self.model.deleted_at.is_(None),
                *conditions,
            )
        )

        return db.scalar(stmt) or 0

    def create(
        self,
        db: Session,
        data: dict[str, Any],
        *,
        actor_id: uuid.UUID,
    ) -> ModelT:
        obj = self.model(
            **data,
            created_by=actor_id,
            updated_by=actor_id,
        )

        db.add(obj)

        if self.audited:
            db.flush()
            db.refresh(obj)

            record_audit(
                db,
                action=AuditAction.CREATE,
                obj=obj,
                actor_id=actor_id,
                new_values=snapshot(obj),
            )

        db.commit()
        db.refresh(obj)

        return obj

    def update(
        self,
        db: Session,
        obj: ModelT,
        data: dict[str, Any],
        *,
        actor_id: uuid.UUID,
    ) -> ModelT:
        old: dict[str, Any] = {}
        new: dict[str, Any] = {}

        for key, value in data.items():
            current = getattr(obj, key)

            if current != value:
                old[key] = current
                new[key] = value

            setattr(obj, key, value)

        obj.updated_by = actor_id

        if self.audited and new:
            record_audit(
                db,
                action=AuditAction.UPDATE,
                obj=obj,
                actor_id=actor_id,
                old_values=old,
                new_values=new,
            )

        db.commit()
        db.refresh(obj)

        return obj

    def soft_delete(
        self,
        db: Session,
        obj: ModelT,
        *,
        actor_id: uuid.UUID,
    ) -> None:
        before = snapshot(obj) if self.audited else None

        now = datetime.now(UTC)

        obj.deleted_at = now
        obj.deleted_by = actor_id

        if self.audited:
            record_audit(
                db,
                action=AuditAction.DELETE,
                obj=obj,
                actor_id=actor_id,
                old_values=before,
                new_values={
                    "deleted_at": now,
                    "deleted_by": actor_id,
                },
            )

        db.commit()
