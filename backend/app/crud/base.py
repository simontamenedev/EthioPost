import uuid
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.db.base_model import BaseEntity

ModelT = TypeVar("ModelT", bound=BaseEntity)


class CRUDBase(Generic[ModelT]):
    """Generic data-access layer. Reads hide soft-deleted rows; deletes are soft."""

    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    def get(self, db: Session, obj_id: uuid.UUID) -> ModelT | None:
        stmt = select(self.model).where(self.model.id == obj_id, self.model.deleted_at.is_(None))
        return db.scalars(stmt).first()

    def get_multi(
        self,
        db: Session,
        *conditions: ColumnElement[bool],
        skip: int = 0,
        limit: int = 50,
    ) -> list[ModelT]:
        stmt = (
            select(self.model)
            .where(self.model.deleted_at.is_(None), *conditions)
            .order_by(self.model.created_at.desc(), self.model.id)
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt))

    def count(self, db: Session, *conditions: ColumnElement[bool]) -> int:
        stmt = select(func.count()).select_from(self.model).where(
            self.model.deleted_at.is_(None), *conditions
        )
        return db.scalar(stmt) or 0

    def create(self, db: Session, data: dict[str, Any], *, actor_id: uuid.UUID) -> ModelT:
        obj = self.model(**data, created_by=actor_id, updated_by=actor_id)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(
        self, db: Session, obj: ModelT, data: dict[str, Any], *, actor_id: uuid.UUID
    ) -> ModelT:
        for key, value in data.items():
            setattr(obj, key, value)
        obj.updated_by = actor_id
        db.commit()
        db.refresh(obj)
        return obj

    def soft_delete(self, db: Session, obj: ModelT, *, actor_id: uuid.UUID) -> None:
        obj.deleted_at = datetime.now(UTC)
        obj.deleted_by = actor_id
        db.commit()
