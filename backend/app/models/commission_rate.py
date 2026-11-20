from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Numeric, String, Table, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import BaseEntity, active_unique_index
from app.models.service_type import ServiceType

commission_rate_service_types = Table(
    "commission_rate_service_types",
    BaseEntity.metadata,
    Column("commission_rate_id", Uuid, ForeignKey("commission_rates.id", ondelete="CASCADE"), primary_key=True),
    Column("service_type_id", Uuid, ForeignKey("service_types.id"), primary_key=True),
    Index("ix_commission_rate_service_types_service_type_id", "service_type_id"),
)


class CommissionRate(BaseEntity):
    """Agent share (% of the FSP commission pool) for one or more service types."""

    __tablename__ = "commission_rates"
    __table_args__ = (
        active_unique_index("uq_commission_rates_service_active", "service_name"),
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_commission_rates_rate_range"),
    )

    service_name: Mapped[str] = mapped_column(String(150))
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))  # percent, e.g. 50.00
    remark: Mapped[str | None] = mapped_column(Text)

    service_types: Mapped[list[ServiceType]] = relationship(
        secondary=commission_rate_service_types, lazy="selectin", order_by=ServiceType.name
    )