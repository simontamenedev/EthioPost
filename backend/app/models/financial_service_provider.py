# app/models/financial_service_provider.py
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import Status
from app.db.base_model import BaseEntity, active_unique_index, enum_column


class FinancialServiceProvider(BaseEntity):
    """A wallet / bank / MNO Ethiopost DFS works with (Telebirr, CBE Birr, ...)."""

    __tablename__ = "financial_service_providers"
    __table_args__ = (
        active_unique_index("uq_fsp_code_active", "code"),
        active_unique_index("uq_fsp_name_active", "name"),
    )

    code: Mapped[str] = mapped_column(String(30))   # TELEBIRR, CBE_BIRR, AHADU, MPESA, COOP, AWASH
    name: Mapped[str] = mapped_column(String(100))  # Telebirr, CBE Birr, ...
    description: Mapped[str | None] = mapped_column(Text)