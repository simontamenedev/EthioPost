# app/schemas/financial_service_provider.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Status
from app.schemas.audit import AuditStamp


class FspCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    status: Status = Status.ACTIVE


class FspUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=30)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    status: Status | None = None


class FspRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    status: Status
    created_at: datetime
    updated_at: datetime


class FspRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str


class FspDetail(FspRead):
    rule_count: int = 0
    import_count: int = 0
    audit: AuditStamp | None = None