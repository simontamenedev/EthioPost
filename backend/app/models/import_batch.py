import uuid
from datetime import date

from sqlalchemy import (
    JSON,
    Date,
    Integer,
    String,
    Uuid,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.datasets import Dataset
from app.db.base_model import BaseEntity, active_unique_index, enum_column


class ImportBatch(BaseEntity):
    """One uploaded CSV file. Every fact row points back to its batch, so a bad
    upload can be rolled back (soft-deleted) as a unit. The same file cannot be
    imported twice (unique on dataset + SHA-256 of the file bytes)."""

    __tablename__ = "import_batches"
    __table_args__ = (
    active_unique_index("uq_import_batches_fsp_dataset_hash_active", "fsp_id", "dataset", "file_hash"),
    )
    fsp_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("financial_service_providers.id"), index=True)
    dataset: Mapped[Dataset] = mapped_column(enum_column(Dataset), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_hash: Mapped[str] = mapped_column(String(64))

    date_from: Mapped[date | None] = mapped_column(Date)
    date_to: Mapped[date | None] = mapped_column(Date)

    rows_total: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    rows_duplicate: Mapped[int] = mapped_column(Integer, default=0)  # already imported earlier
    rows_invalid: Mapped[int] = mapped_column(Integer, default=0)  # failed validation
    rows_unmatched: Mapped[int] = mapped_column(Integer, default=0)  # imported, agent not in master data

    unmatched_shortcodes: Mapped[list | None] = mapped_column(JSON)
    errors: Mapped[list | None] = mapped_column(JSON)  # first N row errors: [{line, error}]