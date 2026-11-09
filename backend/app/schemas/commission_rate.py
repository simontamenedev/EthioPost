import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Status


class CommissionRateCreate(BaseModel):
    service_name: str = Field(min_length=2, max_length=150)
    rate: Decimal = Field(ge=0, le=100, decimal_places=2)
    service_types: list[str] | None = None
    remark: str | None = None
    status: Status = Status.ACTIVE


class CommissionRateUpdate(BaseModel):
    service_name: str | None = Field(None, min_length=2, max_length=150)
    rate: Decimal | None = Field(None, ge=0, le=100, decimal_places=2)
    service_types: list[str] | None = None
    remark: str | None = None
    status: Status | None = None


class CommissionRateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_name: str
    rate: Decimal
    service_types: list[str] | None = None
    remark: str | None = None
    status: Status
    created_at: datetime
    updated_at: datetime