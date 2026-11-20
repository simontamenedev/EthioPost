# app/models/service_target_period.py
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index


class ServiceTypeTargetPeriod(BaseEntity):
    """Part of a target that falls between two dates.

    Periods can be any length. They must stay inside the target's date range, must not
    overlap each other, and must not add up to more than the target (all checked in the
    service layer).
    """

    __tablename__ = "service_type_target_periods"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_service_type_target_periods_dates_order"),
        CheckConstraint("target_value >= 0", name="ck_service_type_target_periods_value_non_negative"),
        active_unique_index(
            "uq_service_type_target_periods_target_start_active",
            "service_type_target_id",
            "start_date",
        ),
    )

    service_type_target_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_type_targets.id", ondelete="RESTRICT"), index=True
    )
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date)
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days + 1