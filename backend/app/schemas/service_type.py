# app/schemas/service_type.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Status
from app.schemas.audit import AuditStamp


class ServiceTypeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=100)
    csv_label: str | None = Field(default=None, max_length=50)
    description: str | None = None
    status: Status = Status.ACTIVE


class ServiceTypeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=50)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    csv_label: str | None = Field(default=None, max_length=50)
    description: str | None = None
    status: Status | None = None


class ServiceTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    csv_label: str | None
    description: str | None
    status: Status
    created_at: datetime
    updated_at: datetime


class ServiceTypeRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str


class ServiceTypeDetail(ServiceTypeRead):
    rule_count: int = 0
    audit: AuditStamp | None = None