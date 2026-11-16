# app/models/service_target.py
import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import BaseEntity, active_unique_index
from app.models.district import District
from app.models.service_type import ServiceType
from decimal import ROUND_DOWN, Decimal

CENT = Decimal("0.01")

PERCENT = Decimal("0.01")


class ServiceTypeTarget(BaseEntity):
    """National annual target covering one or more service types.

    Example: "Cash In + Cash Out 2026" = 1,000,000 shared by CASH_IN and CASH_OUT.
    The service types are linked through `ServiceTypeTargetItem`; the target is split
    across districts via `DistrictTarget`. `target_value` is the source of truth and
    percentages are always derived.

    All service types in one target should share the same unit (count or amount).
    """

    __tablename__ = "service_type_targets"
    __table_args__ = (
        # Needed so ServiceTypeTargetItem can reference (id, year) with a composite FK.
        UniqueConstraint("id", "year", name="uq_service_type_targets_id_year"),
        CheckConstraint("target_value >= 0", name="ck_service_type_targets_value_non_negative"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="ck_service_type_targets_year_range"),
    )

    name: Mapped[str | None] = mapped_column(String(150))  # optional label, e.g. "Cash In + Cash Out"
    year: Mapped[int] = mapped_column(Integer, index=True)
    # Unit depends on the services (transaction count or amount).
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    # Read-only views of the *active* (not soft-deleted) children.
    # Create/update/delete the child rows directly (see the service layer).
    items: Mapped[list["ServiceTypeTargetItem"]] = relationship(
        primaryjoin=(
            "and_(ServiceTypeTarget.id == ServiceTypeTargetItem.service_type_target_id, "
            "ServiceTypeTargetItem.deleted_at.is_(None))"
        ),
        foreign_keys="ServiceTypeTargetItem.service_type_target_id",
        viewonly=True,
    )
    district_targets: Mapped[list["DistrictTarget"]] = relationship(
        primaryjoin=(
            "and_(ServiceTypeTarget.id == DistrictTarget.service_type_target_id, "
            "DistrictTarget.deleted_at.is_(None))"
        ),
        viewonly=True,
    )

    @property
    def service_types(self) -> list[ServiceType]:
        return [item.service_type for item in self.items]

    @property
    def allocated_value(self) -> Decimal:
        return sum((dt.target_value for dt in self.district_targets), Decimal("0"))

    @property
    def unallocated_value(self) -> Decimal:
        return self.target_value - self.allocated_value

    @property
    def allocated_percent(self) -> Decimal:
        if not self.target_value:
            return Decimal("0.00")
        return (self.allocated_value / self.target_value * 100).quantize(PERCENT)

    @property
    def unallocated_percent(self) -> Decimal:
        return Decimal("100.00") - self.allocated_percent


class ServiceTypeTargetItem(BaseEntity):
    """Links a service type to a target.

    `year` is copied from the target (kept consistent by the composite FK) so the
    database can guarantee that a service type belongs to only ONE active target
    per year.
    """

    __tablename__ = "service_type_target_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["service_type_target_id", "year"],
            ["service_type_targets.id", "service_type_targets.year"],
            name="fk_service_type_target_items_target_year",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        active_unique_index(
            "uq_service_type_target_items_target_service_active",
            "service_type_target_id",
            "service_type_id",
        ),
        active_unique_index(
            "uq_service_type_target_items_service_year_active",
            "service_type_id",
            "year",
        ),
    )

    service_type_target_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    year: Mapped[int] = mapped_column(Integer)
    service_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_types.id", ondelete="RESTRICT"), index=True
    )

    service_type: Mapped[ServiceType] = relationship()


class DistrictTarget(BaseEntity):
    """Share of a `ServiceTypeTarget` assigned to one district."""

    __tablename__ = "district_targets"
    __table_args__ = (
        active_unique_index(
            "uq_district_targets_target_district_active",
            "service_type_target_id",
            "district_id",
        ),
        CheckConstraint("target_value >= 0", name="ck_district_targets_value_non_negative"),
    )

    service_type_target_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_type_targets.id", ondelete="RESTRICT"), index=True
    )
    district_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("districts.id", ondelete="RESTRICT"), index=True
    )
    target_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    service_type_target: Mapped[ServiceTypeTarget] = relationship()
    district: Mapped[District] = relationship()\

     # Active (not soft-deleted) monthly percentages, ordered Jan..Dec.
    months: Mapped[list["DistrictTargetMonth"]] = relationship(
        primaryjoin=(
            "and_(DistrictTarget.id == DistrictTargetMonth.district_target_id, "
            "DistrictTargetMonth.deleted_at.is_(None))"
        ),
        order_by="DistrictTargetMonth.month",
        viewonly=True,
    )


    @property
    def target_percent(self) -> Decimal:
        """This district's share of the national annual target, in %."""
        total = self.service_type_target.target_value
        if not total:
            return Decimal("0.00")
        return (self.target_value / total * 100).quantize(PERCENT)
    @property
    def phased_percent(self) -> Decimal:
        """Share of this district's target already spread over months, in %."""
        return sum((m.percent for m in self.months), Decimal("0.00"))

    @property
    def monthly_targets(self) -> list[dict]:
        """[{month, percent, target_value}] for months that have a share.

        Values round down to the cent. When the months total exactly 100%, the
        remainder goes to the largest month so they add up to the district value.
        """
        rows = self.months
        values = {r.month: (self.target_value * r.percent / 100).quantize(CENT, rounding=ROUND_DOWN) for r in rows}
        if rows and self.phased_percent == 100:
            largest = max(rows, key=lambda r: r.percent)
            values[largest.month] += self.target_value - sum(values.values(), Decimal("0"))
        return [{"month": r.month, "percent": r.percent, "target_value": values[r.month]} for r in rows]

class DistrictTargetMonth(BaseEntity):
    """Share (in %) of a district's target that falls in one calendar month."""

    __tablename__ = "district_target_months"
    __table_args__ = (
        active_unique_index(
            "uq_district_target_months_target_month_active",
            "district_target_id",
            "month",
        ),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_district_target_months_month_range"),
        CheckConstraint("percent >= 0 AND percent <= 100", name="ck_district_target_months_percent_range"),
    )

    district_target_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("district_targets.id", ondelete="RESTRICT"), index=True
    )
    month: Mapped[int] = mapped_column(Integer)  # 1 = January ... 12 = December
    percent: Mapped[Decimal] = mapped_column(Numeric(5, 2))    