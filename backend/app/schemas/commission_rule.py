# app/schemas/commission_rule.py
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import CommissionBasis, CommissionType, Status
from app.schemas.audit import AuditStamp
from app.schemas.financial_service_provider import FspRef
from app.schemas.service_type import ServiceTypeRef


class CommissionRuleCreate(BaseModel):
    fsp_id: uuid.UUID
    service_type_id: uuid.UUID
    qualifier: str | None = Field(default=None, max_length=100)
    min_amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    max_amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    commission_type: CommissionType
    basis: CommissionBasis | None = None
    rate: Decimal = Field(ge=0, max_digits=12, decimal_places=4)
    conditions: str | None = None
    effective_from: date
    effective_to: date | None = None
    status: Status = Status.ACTIVE


class CommissionRuleUpdate(BaseModel):
    fsp_id: uuid.UUID | None = None
    service_type_id: uuid.UUID | None = None
    qualifier: str | None = Field(default=None, max_length=100)
    min_amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    max_amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    commission_type: CommissionType | None = None
    basis: CommissionBasis | None = None
    rate: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=4)
    conditions: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    status: Status | None = None


class CommissionRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fsp_id: uuid.UUID
    service_type_id: uuid.UUID
    fsp: FspRef
    service_type: ServiceTypeRef
    qualifier: str | None
    min_amount: Decimal | None
    max_amount: Decimal | None
    commission_type: CommissionType
    basis: CommissionBasis | None
    rate: Decimal
    conditions: str | None
    effective_from: date
    effective_to: date | None
    status: Status
    created_at: datetime
    updated_at: datetime


class CommissionRuleDetail(CommissionRuleRead):
    audit: AuditStamp | None = None