import uuid
from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.db.base_model import BaseEntity

ModelT = TypeVar("ModelT", bound=BaseEntity)


def get_or_404(crud: CRUDBase[ModelT], db: Session, obj_id: uuid.UUID, label: str) -> ModelT:
    obj = crud.get(db, obj_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return obj


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
