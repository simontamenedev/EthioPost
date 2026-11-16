# app/services/service_target_service.py
import uuid
from datetime import UTC, datetime
from decimal import ROUND_DOWN, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DistrictTarget, ServiceTypeTarget, ServiceTypeTargetItem
from decimal import ROUND_DOWN, Decimal
from app.models import DistrictTarget, DistrictTargetMonth, ServiceTypeTarget, ServiceTypeTargetItem
from sqlalchemy import extract, func, select
from app.models import Agent, AgentTransaction
from datetime import UTC, date, datetime
PCT = Decimal("0.01")

CENT = Decimal("0.01")


class TargetAllocationError(ValueError):
    """The requested district split or national target is invalid."""


class TargetServiceTypeError(ValueError):
    """The requested service types conflict with another target."""
# ---- performance -----------------------------------------------------------
COUNTED_STATUS = "COMPLETED"
ZERO = Decimal("0.00")


def _pct(actual: Decimal, target: Decimal) -> Decimal | None:
    if not target:
        return None
    return (actual / target * 100).quantize(PCT)


def _actuals(session: Session, target: ServiceTypeTarget, metric: str) -> dict[uuid.UUID, dict[int, Decimal]]:
    """district_id -> month -> actual, for the target's year and service types."""
    names = {s.name.strip().lower() for s in target.service_types}
    if not names:
        return {}
    column = AgentTransaction.total_amount if metric == "amount" else AgentTransaction.txn_count
    month = extract("month", AgentTransaction.txn_date)

    rows = session.execute(
        select(Agent.district_id, month, func.coalesce(func.sum(column), 0))
        .select_from(AgentTransaction)
        .join(
            Agent,
            (Agent.agent_shortcode == AgentTransaction.agent_shortcode) & Agent.deleted_at.is_(None),
        )
        .where(
            AgentTransaction.deleted_at.is_(None),
            AgentTransaction.txn_status == COUNTED_STATUS,
            AgentTransaction.txn_date >= date(target.year, 1, 1),
            AgentTransaction.txn_date <= date(target.year, 12, 31),
            func.lower(func.trim(AgentTransaction.service_type)).in_(names),
        )
        .group_by(Agent.district_id, month)
    ).all()

    out: dict[uuid.UUID, dict[int, Decimal]] = {}
    for district_id, m, value in rows:
        out.setdefault(district_id, {})[int(m)] = Decimal(value)
    return out


def target_performance(
    session: Session,
    target: ServiceTypeTarget,
    metric: str = "amount",
    district_id: uuid.UUID | None = None,
) -> dict:
    """Actual vs target per district, for the year and for each month."""
    actual = _actuals(session, target, metric)
    shares = sorted(target.district_targets, key=lambda dt: dt.district.name)
    with_share = {dt.district_id for dt in shares}

    districts = []
    for dt in shares:
        if district_id and dt.district_id != district_id:
            continue
        by_month = actual.get(dt.district_id, {})
        month_targets = {m["month"]: m["target_value"] for m in dt.monthly_targets}

        months = []
        for m in range(1, 13):
            t, a = month_targets.get(m, ZERO), by_month.get(m, ZERO)
            months.append(
                {"month": m, "target_value": t, "actual_value": a, "variance": a - t,
                 "achievement_percent": _pct(a, t)}
            )
        year_actual = sum(by_month.values(), ZERO)
        districts.append(
            {
                "district_id": dt.district_id,
                "district_name": dt.district.name,
                "target_value": dt.target_value,
                "actual_value": year_actual,
                "variance": year_actual - dt.target_value,
                "achievement_percent": _pct(year_actual, dt.target_value),
                "months": months,
            }
        )

    total_actual = sum((d["actual_value"] for d in districts), ZERO)
    outside = sum(
        (sum(v.values(), ZERO) for d_id, v in actual.items() if d_id not in with_share), ZERO
    )
    return {
        "target_id": target.id,
        "name": target.name,
        "year": target.year,
        "metric": metric,
        "target_value": target.target_value,
        "allocated_value": target.allocated_value,
        "actual_value": total_actual,
        "achievement_percent": _pct(total_actual, target.target_value),
        "actual_outside_districts": outside,
        "districts": districts,
    }

def _down(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_DOWN)


# ---- district split --------------------------------------------------------
def _active_district_targets(session: Session, target_id: uuid.UUID) -> dict[uuid.UUID, DistrictTarget]:
    rows = session.scalars(
        select(DistrictTarget).where(
            DistrictTarget.service_type_target_id == target_id,
            DistrictTarget.deleted_at.is_(None),
        )
    )
    return {r.district_id: r for r in rows}


def replace_district_targets(
    session: Session,
    target: ServiceTypeTarget,
    allocations: dict[uuid.UUID, Decimal],
    actor_id: uuid.UUID | None = None,
) -> None:
    """Make the district split exactly `allocations` (district_id -> value).

    Districts missing from the mapping are soft-deleted. Flushes, never commits.
    """
    if any(v < 0 for v in allocations.values()):
        raise TargetAllocationError("District targets cannot be negative.")
    total = sum(allocations.values(), Decimal("0"))
    if total > target.target_value:
        raise TargetAllocationError(
            f"Allocated {total} exceeds the annual target {target.target_value}."
        )

    existing = _active_district_targets(session, target.id)
    now = datetime.now(UTC)

    for district_id, value in allocations.items():
        row = existing.pop(district_id, None)
        if row:
            row.target_value = value
            row.updated_by = actor_id
        else:
            session.add(
                DistrictTarget(
                    service_type_target_id=target.id,
                    district_id=district_id,
                    target_value=value,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )
    for row in existing.values():  # no longer in the split
        row.deleted_at = now
        row.deleted_by = actor_id
        _drop_months(session, row.id, actor_id, now)   # <-- add

    session.flush()
    session.expire(target, ["district_targets"])


def allocate_by_percent(
    session: Session,
    target: ServiceTypeTarget,
    percents: dict[uuid.UUID, Decimal],
    actor_id: uuid.UUID | None = None,
) -> None:
    """Split by percentage (district_id -> %). Percentages must total <= 100."""
    if any(p < 0 or p > 100 for p in percents.values()):
        raise TargetAllocationError("Each percentage must be between 0 and 100.")
    total_pct = sum(percents.values(), Decimal("0"))
    if total_pct > 100:
        raise TargetAllocationError(f"Percentages total {total_pct}%, more than 100%.")

    allocations = {d: _down(target.target_value * p / 100) for d, p in percents.items()}

    # A full 100% split must add up exactly: give the rounding remainder to the largest share.
    if total_pct == 100 and allocations:
        remainder = target.target_value - sum(allocations.values())
        largest = max(percents, key=percents.get)
        allocations[largest] += remainder

    replace_district_targets(session, target, allocations, actor_id)


def split_evenly(
    session: Session,
    target: ServiceTypeTarget,
    district_ids: list[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> None:
    if not district_ids:
        raise TargetAllocationError("Select at least one district.")
    share = _down(target.target_value / len(district_ids))
    allocations = {d: share for d in district_ids}
    allocations[district_ids[0]] += target.target_value - share * len(district_ids)
    replace_district_targets(session, target, allocations, actor_id)


def update_national_target(
    session: Session,
    target: ServiceTypeTarget,
    new_value: Decimal,
    keep_percentages: bool = True,
    actor_id: uuid.UUID | None = None,
) -> None:
    """Change the annual target. With keep_percentages, district shares scale with it."""
    if new_value < 0:
        raise TargetAllocationError("Target cannot be negative.")
    old_value = target.target_value
    current = _active_district_targets(session, target.id)

    if keep_percentages and old_value and current:
        fully_allocated = sum(r.target_value for r in current.values()) == old_value
        scaled = {d: _down(r.target_value * new_value / old_value) for d, r in current.items()}
        if fully_allocated:
            largest = max(scaled, key=scaled.get)
            scaled[largest] += new_value - sum(scaled.values())
        target.target_value = new_value
        target.updated_by = actor_id
        replace_district_targets(session, target, scaled, actor_id)
    else:
        if sum((r.target_value for r in current.values()), Decimal("0")) > new_value:
            raise TargetAllocationError(
                "New target is lower than what is already allocated to districts."
            )
        target.target_value = new_value
        target.updated_by = actor_id
        session.flush()


# ---- service types ---------------------------------------------------------
def set_service_types(
    session: Session,
    target: ServiceTypeTarget,
    service_type_ids: set[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> None:
    """Make the target cover exactly `service_type_ids` (others are soft-deleted).

    Flushes, never commits.
    """
    if not service_type_ids:
        raise TargetServiceTypeError("A target needs at least one service type.")

    # A service type can only be in one active target per year.
    conflicts = session.scalars(
        select(ServiceTypeTargetItem.service_type_id).where(
            ServiceTypeTargetItem.service_type_id.in_(service_type_ids),
            ServiceTypeTargetItem.year == target.year,
            ServiceTypeTargetItem.service_type_target_id != target.id,
            ServiceTypeTargetItem.deleted_at.is_(None),
        )
    ).all()
    if conflicts:
        raise TargetServiceTypeError(
            f"Service types already in another {target.year} target: {sorted(map(str, conflicts))}"
        )

    existing = {
        i.service_type_id: i
        for i in session.scalars(
            select(ServiceTypeTargetItem).where(
                ServiceTypeTargetItem.service_type_target_id == target.id,
                ServiceTypeTargetItem.deleted_at.is_(None),
            )
        )
    }
    now = datetime.now(UTC)

    for service_type_id in service_type_ids - existing.keys():
        session.add(
            ServiceTypeTargetItem(
                service_type_target_id=target.id,
                year=target.year,
                service_type_id=service_type_id,
                created_by=actor_id,
                updated_by=actor_id,
            )
        )
    for service_type_id in existing.keys() - service_type_ids:
        item = existing[service_type_id]
        item.deleted_at = now
        item.deleted_by = actor_id

    session.flush()
    session.expire(target, ["items"])

# ---- monthly phasing -------------------------------------------------------
def _active_months(session: Session, district_target_id: uuid.UUID) -> dict[int, DistrictTargetMonth]:
    rows = session.scalars(
        select(DistrictTargetMonth).where(
            DistrictTargetMonth.district_target_id == district_target_id,
            DistrictTargetMonth.deleted_at.is_(None),
        )
    )
    return {r.month: r for r in rows}


def _drop_months(session: Session, district_target_id: uuid.UUID, actor_id, now) -> None:
    for row in _active_months(session, district_target_id).values():
        row.deleted_at = now
        row.deleted_by = actor_id


def replace_monthly_percents(
    session: Session,
    district_target: DistrictTarget,
    percents: dict[int, Decimal],
    actor_id: uuid.UUID | None = None,
) -> None:
    """Make the district's monthly phasing exactly `percents` (month 1-12 -> %).

    Months missing (or at 0) are soft-deleted. Total must be <= 100. Flushes, never commits.
    """
    if any(m < 1 or m > 12 for m in percents):
        raise TargetAllocationError("Month must be between 1 and 12.")
    if any(p < 0 or p > 100 for p in percents.values()):
        raise TargetAllocationError("Each monthly percentage must be between 0 and 100.")
    percents = {m: p for m, p in percents.items() if p > 0}
    total = sum(percents.values(), Decimal("0"))
    if total > 100:
        raise TargetAllocationError(f"Monthly percentages total {total}%, more than 100%.")

    existing = _active_months(session, district_target.id)
    now = datetime.now(UTC)

    for month, pct in percents.items():
        row = existing.pop(month, None)
        if row:
            row.percent = pct
            row.updated_by = actor_id
        else:
            session.add(
                DistrictTargetMonth(
                    district_target_id=district_target.id,
                    month=month,
                    percent=pct,
                    created_by=actor_id,
                    updated_by=actor_id,
                )
            )
    for row in existing.values():
        row.deleted_at = now
        row.deleted_by = actor_id

    session.flush()
    session.expire(district_target, ["months"])


def split_months_evenly(
    session: Session, district_target: DistrictTarget, actor_id: uuid.UUID | None = None
) -> None:
    """12 equal months; January absorbs the rounding remainder (8.37 + 11 x 8.33 = 100)."""
    share = (Decimal("100") / 12).quantize(PCT, rounding=ROUND_DOWN)
    percents = {m: share for m in range(1, 13)}
    percents[1] += Decimal("100") - share * 12
    replace_monthly_percents(session, district_target, percents, actor_id)    