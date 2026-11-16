# app/schemas/service_type_target.py
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.enums import Status

Money = Field(ge=0, max_digits=18, decimal_places=2)


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ServiceTypeRef(_ORM):
    id: uuid.UUID
    code: str
    name: str


class DistrictRef(_ORM):
    id: uuid.UUID
    name: str


# ---- targets ---------------------------------------------------------------
class TargetCreate(BaseModel):
    name: str | None = Field(None, max_length=150)
    year: int = Field(ge=2000, le=2100)
    target_value: Decimal = Money
    service_type_ids: list[uuid.UUID] = Field(min_length=1)
    status: Status = Status.ACTIVE


class TargetUpdate(BaseModel):
    """The year is fixed after creation; create a new target for another year."""

    name: str | None = Field(None, max_length=150)
    target_value: Decimal | None = Field(None, ge=0, max_digits=18, decimal_places=2)
    service_type_ids: list[uuid.UUID] | None = Field(None, min_length=1)
    status: Status | None = None
    # When target_value changes: scale district shares with it (True) or keep their values (False).
    keep_percentages: bool = True


class TargetRead(_ORM):
    id: uuid.UUID
    name: str | None
    year: int
    target_value: Decimal
    status: Status
    created_at: datetime
    updated_at: datetime
    service_types: list[ServiceTypeRef]
    allocated_value: Decimal
    unallocated_value: Decimal
    allocated_percent: Decimal
    unallocated_percent: Decimal

class MonthTargetRead(BaseModel):
    month: int
    percent: Decimal
    target_value: Decimal

class DistrictTargetRead(_ORM):
    id: uuid.UUID
    district_id: uuid.UUID
    district: DistrictRef
    target_value: Decimal
    target_percent: Decimal
    phased_percent: Decimal
    monthly_targets: list[MonthTargetRead] = []


class TargetDetail(TargetRead):
    district_targets: list[DistrictTargetRead] = []
    audit: Any | None = None  # swap for your AuditStamp schema if FspDetail uses a typed one


# ---- district split --------------------------------------------------------
class DistrictAllocationItem(BaseModel):
    district_id: uuid.UUID
    # A value (mode "value") or a percentage (mode "percent"); ignored for mode "even".
    amount: Decimal | None = Field(None, ge=0, max_digits=18, decimal_places=2)


class DistrictAllocationPayload(BaseModel):
    mode: Literal["value", "percent", "even"]
    # An empty list clears the split (value / percent modes only; "even" needs districts).
    allocations: list[DistrictAllocationItem] = []

    @model_validator(mode="after")
    def _check(self) -> "DistrictAllocationPayload":
        ids = [a.district_id for a in self.allocations]
        if len(ids) != len(set(ids)):
            raise ValueError("Each district can appear only once.")
        if self.mode != "even" and any(a.amount is None for a in self.allocations):
            raise ValueError("Every district needs an amount.")
        return self


class DistrictAllocationRow(BaseModel):
    """One district in the allocation editor, including districts with no share yet."""

    district_id: uuid.UUID
    district_name: str
    target_value: Decimal
    target_percent: Decimal




class DistrictTargetRead(_ORM):
    id: uuid.UUID
    district_id: uuid.UUID
    district: DistrictRef
    target_value: Decimal
    target_percent: Decimal
    phased_percent: Decimal                      # new
    monthly_targets: list[MonthTargetRead] = []  # new


# ---- monthly phasing -------------------------------------------------------
class MonthPercentItem(BaseModel):
    month: int = Field(ge=1, le=12)
    percent: Decimal | None = Field(None, ge=0, le=100, max_digits=5, decimal_places=2)


class MonthAllocationPayload(BaseModel):
    mode: Literal["percent", "even"]
    # Percent mode: an empty list clears the phasing. Ignored for "even".
    months: list[MonthPercentItem] = Field(default=[], max_length=12)
    # Copy the same phasing to every district of this target (e.g. national seasonality).
    apply_to_all_districts: bool = False

    @model_validator(mode="after")
    def _check(self) -> "MonthAllocationPayload":
        months = [m.month for m in self.months]
        if len(months) != len(set(months)):
            raise ValueError("Each month can appear only once.")
        if self.mode == "percent":
            if any(m.percent is None for m in self.months):
                raise ValueError("Every month needs a percentage.")
            if sum((m.percent for m in self.months), Decimal("0")) > 100:
                raise ValueError("Monthly percentages cannot total more than 100%.")
        return self


class MonthAllocationResponse(BaseModel):
    """All 12 months of one district's phasing (0 where a month has no share)."""

    district_id: uuid.UUID
    district_name: str
    target_value: Decimal
    months: list[MonthTargetRead]    

class MonthPerformance(BaseModel):
    month: int
    target_value: Decimal
    actual_value: Decimal
    variance: Decimal                       # actual - target
    achievement_percent: Decimal | None     # None when the month has no target


class DistrictPerformance(BaseModel):
    district_id: uuid.UUID
    district_name: str
    target_value: Decimal
    actual_value: Decimal
    variance: Decimal
    achievement_percent: Decimal | None
    months: list[MonthPerformance]


class TargetPerformance(BaseModel):
    target_id: uuid.UUID
    name: str | None
    year: int
    metric: Literal["amount", "count"]
    target_value: Decimal                   # national annual target
    allocated_value: Decimal                # sum of district targets
    actual_value: Decimal                   # districts that have a share
    achievement_percent: Decimal | None
    actual_outside_districts: Decimal       # actual in districts with no share
    districts: list[DistrictPerformance]