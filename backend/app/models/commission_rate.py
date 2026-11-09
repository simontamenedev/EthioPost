from decimal import Decimal

from sqlalchemy import JSON, CheckConstraint, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index


class CommissionRate(BaseEntity):
    """Agent commission percentage for one DFS product/service (Ethiopost commission sheet)."""

    __tablename__ = "commission_rates"
    __table_args__ = (
        active_unique_index("uq_commission_rates_service_active", "service_name"),
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_commission_rates_rate_range"),
    )

    service_name: Mapped[str] = mapped_column(String(150))
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))  # percent, e.g. 50.00
    # CSV "Service Type" values this rate applies to, e.g. ["Cash In", "Cash Out"].
    service_types: Mapped[list[str] | None] = mapped_column(JSON)
    remark: Mapped[str | None] = mapped_column(Text)