# app/models/service_type.py
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index


class ServiceType(BaseEntity):
    """Catalogue of services that can earn commission. Shared by all FSPs.

    `csv_label` is the value that appears in the transactions report
    ("Cash In", "Cash Out", "Airtime Top Up", "Bill Payment"); it is NULL for
    services that are not reported as transactions (agent registration, annuity ...).
    """

    __tablename__ = "service_types"
    __table_args__ = (active_unique_index("uq_service_types_code_active", "code"),)

    code: Mapped[str] = mapped_column(String(50))   # CASH_IN, CASH_OUT, CUSTOMER_REGISTRATION ...
    name: Mapped[str] = mapped_column(String(100))
    csv_label: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(Text)