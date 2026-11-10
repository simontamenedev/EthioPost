import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from app.core.datasets import Dataset

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int


class CommissionSnapshotRead(BaseModel):
    """Commission as calculated and frozen at import time."""

    model_config = ConfigDict(from_attributes=True)

    commission_rule_id: uuid.UUID | None = None
    commission_rate_id: uuid.UUID | None = None
    fsp_commission_type: str | None = None
    fsp_commission_basis: str | None = None
    fsp_commission_rate: Decimal | None = None
    fsp_commission_amount: Decimal | None = None
    agent_commission_rate: Decimal | None = None
    agent_commission_amount: Decimal | None = None
    ethiopost_commission_amount: Decimal | None = None
    commission_status: str | None = None


class _FactRead(CommissionSnapshotRead):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID | None
    agent_shortcode: str
    organization_name: str
    region: str | None
    import_batch_id: uuid.UUID


class TransactionRead(_FactRead):
    txn_date: date
    service_type: str
    channel: str
    txn_status: str
    debit_shortcode: str
    credit_shortcode: str
    txn_count: int
    total_amount: Decimal
    failure_reason: str | None


class RegistrationRead(_FactRead):
    reg_date: date
    customer_status: str
    registration_count: int


class UpgradeRead(_FactRead):
    upgrade_date: date
    upgrade_at: str
    before_level: str
    after_level: str
    upgrade_count: int


class ImportBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fsp_id: uuid.UUID
    dataset: Dataset
    filename: str
    date_from: date | None
    date_to: date | None
    rows_total: int
    rows_imported: int
    rows_duplicate: int
    rows_invalid: int
    rows_unmatched: int
    unmatched_shortcodes: list[str] | None
    errors: list[dict] | None
    created_at: datetime
    created_by: uuid.UUID | None