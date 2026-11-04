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


class _FactRead(BaseModel):
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