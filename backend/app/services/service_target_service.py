# app/services/service_target_service.py
import logging
import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_DOWN, Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.api.utils import conflict
from app.crud import service_type_target_period_crud
from app.models import (
    Agent,
    AgentTransaction,
    DistrictTarget,
    DistrictTargetMonth,
    ServiceType,
    ServiceTypeTarget,
    ServiceTypeTargetItem,
)
from app.schemas.service_type_target import PeriodTargetIn
from app.services.district_tree import root_map, to_root

logger = logging.getLogger("uvicorn.error")  # shows in the uvicorn console

DEBUG_PERF = True  # prints "[perf] ..." lines to the console; set to False when done


def _dbg(*args) -> None:
    if DEBUG_PERF:
        print("[perf]", *args, flush=True)


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


def _actuals(
    session: Session,
    target: ServiceTypeTarget,
    metric: str,
    roots: dict[uuid.UUID, uuid.UUID],
) -> dict[uuid.UUID, dict[int, Decimal]]:
    """parent district_id -> month -> actual, for the target's date range and service types.

    Agents belong to CHILD districts (ET regions) while targets are set on PARENT districts,
    so every child's figures are added to its parent (`roots` maps child -> parent).

    NOTE: months are calendar months (1-12). If a target spans more than one year, the same
    month of different years is added together.
    """
    # Transactions store the report's label ("Cash In"), which is ServiceType.csv_label;
    # the display name is also accepted. Service types without a csv_label (registrations,
    # annuity...) are not transactions and simply match nothing here.
    names = {
        v.strip().lower()
        for s in target.service_types
        for v in (s.csv_label, s.name)
        if v
    }
    _dbg("target", target.id, "range", target.start_date, "to", target.end_date, "metric", metric)
    _dbg("service types:", [(s.code, s.name, s.csv_label) for s in target.service_types])
    _dbg("names matched against transactions:", sorted(names), "| required status:", COUNTED_STATUS)
    _dbg("child -> parent pairs known:", len(roots))
    if not names:
        _dbg("STOP: the target has no service type with a name/csv_label")
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
            func.upper(func.trim(AgentTransaction.txn_status)) == COUNTED_STATUS,
            AgentTransaction.txn_date >= target.start_date,
            AgentTransaction.txn_date <= target.end_date,
            func.lower(func.trim(AgentTransaction.service_type)).in_(names),
        )
        .group_by(Agent.district_id, month)
    ).all()

    _dbg("rows returned by the actuals query (agent district, month, sum):", len(rows))
    for r in rows[:15]:
        _dbg("   ", r)
    if not rows:  # make a silent 0 explainable: say what was wanted and what the data has
        T = AgentTransaction
        have = session.execute(
            select(T.service_type, T.txn_status, func.count())
            .where(
                T.deleted_at.is_(None),
                T.txn_date >= target.start_date,
                T.txn_date <= target.end_date,
            )
            .group_by(T.service_type, T.txn_status)
            .order_by(func.count().desc())
            .limit(10)
        ).all()
        logger.warning(
            "Target %s (%s to %s): no transactions matched. Wanted service types %s with status %s. "
            "Transactions in that range are (service_type, status, rows): %s",
            target.id, target.start_date, target.end_date, sorted(names), COUNTED_STATUS, have,
        )

    out: dict[uuid.UUID, dict[int, Decimal]] = {}
    for district_id, m, value in rows:
        by_month = out.setdefault(to_root(roots, district_id), {})
        by_month[int(m)] = by_month.get(int(m), ZERO) + Decimal(value)
    for d_id, months in out.items():
        _dbg("rolled up ->", d_id, "total", sum(months.values(), ZERO), "months", dict(sorted(months.items())))
    return out


def target_performance(
    session: Session,
    target: ServiceTypeTarget,
    metric: str = "amount",
    district_id: uuid.UUID | None = None,
) -> dict:
    """Actual vs target per parent district, for the date range and for each month.

    A parent's actual is the sum of its children's actuals.
    """
    roots = root_map(session)
    if district_id:
        district_id = to_root(roots, district_id)  # asking for a child shows its parent
    actual = _actuals(session, target, metric, roots)
    shares = sorted(target.district_targets, key=lambda dt: dt.district.name)
    with_share = {dt.district_id for dt in shares}
    _dbg("districts with a target share:", len(with_share))
    _dbg("districts that have actuals:", len(actual), "| of those with a share:", len(set(actual) & with_share))

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
        range_actual = sum(by_month.values(), ZERO)
        districts.append(
            {
                "district_id": dt.district_id,
                "district_name": dt.district.name,
                "target_value": dt.target_value,
                "actual_value": range_actual,
                "variance": range_actual - dt.target_value,
                "achievement_percent": _pct(range_actual, dt.target_value),
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
        "start_date": target.start_date,
        "end_date": target.end_date,
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
            f"Allocated {total} exceeds the target {target.target_value}."
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
        _drop_months(session, row.id, actor_id, now)

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
    """Change the target value. With keep_percentages, district shares scale with it."""
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
def overlapping_service_type_names(
    session: Session,
    service_type_ids: set[uuid.UUID],
    start_date: date,
    end_date: date,
    exclude_target_id: uuid.UUID | None = None,
) -> list[str]:
    """Names of the given service types already covered by ANOTHER active target whose
    date range overlaps start_date..end_date (ranges are inclusive on both ends)."""
    if not service_type_ids:
        return []
    stmt = (
        select(ServiceType.name)
        .join(ServiceTypeTargetItem, ServiceTypeTargetItem.service_type_id == ServiceType.id)
        .join(ServiceTypeTarget, ServiceTypeTarget.id == ServiceTypeTargetItem.service_type_target_id)
        .where(
            ServiceTypeTargetItem.service_type_id.in_(service_type_ids),
            ServiceTypeTargetItem.deleted_at.is_(None),
            ServiceTypeTarget.deleted_at.is_(None),
            ServiceTypeTarget.start_date <= end_date,
            ServiceTypeTarget.end_date >= start_date,
        )
        .distinct()
    )
    if exclude_target_id:
        stmt = stmt.where(ServiceTypeTarget.id != exclude_target_id)
    return sorted(session.scalars(stmt))


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

    # A service type can only be in one active target for any given date.
    names = overlapping_service_type_names(
        session, service_type_ids, target.start_date, target.end_date, exclude_target_id=target.id
    )
    if names:
        raise TargetServiceTypeError(
            f"Service types already in another target overlapping "
            f"{target.start_date} to {target.end_date}: {', '.join(names)}"
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


# ---- diagnostics -----------------------------------------------------------
def performance_debug(session: Session, target: ServiceTypeTarget) -> dict:
    """Why are the actuals what they are? Row counts after each filter of `_actuals`."""
    T = AgentTransaction
    names = sorted(
        {v.strip().lower() for s in target.service_types for v in (s.csv_label, s.name) if v}
    )

    def count(*conds, join_agent: bool = False) -> int:
        stmt = select(func.count()).select_from(T)
        if join_agent:
            stmt = stmt.join(
                Agent, (Agent.agent_shortcode == T.agent_shortcode) & Agent.deleted_at.is_(None)
            )
        return session.scalar(stmt.where(T.deleted_at.is_(None), *conds)) or 0

    in_range = (T.txn_date >= target.start_date, T.txn_date <= target.end_date)
    status_ok = func.upper(func.trim(T.txn_status)) == COUNTED_STATUS
    type_ok = func.lower(func.trim(T.service_type)).in_(names or ["\0"])

    lo, hi = session.execute(
        select(func.min(T.txn_date), func.max(T.txn_date)).where(T.deleted_at.is_(None))
    ).one()
    combos = session.execute(
        select(T.service_type, T.txn_status, func.count(), func.sum(T.total_amount))
        .where(T.deleted_at.is_(None))
        .group_by(T.service_type, T.txn_status)
        .order_by(func.count().desc())
        .limit(15)
    ).all()

    return {
        "target_start_date": target.start_date,
        "target_end_date": target.end_date,
        "target_service_types": [
            {"code": s.code, "name": s.name, "csv_label": s.csv_label} for s in target.service_types
        ],
        "names_matched_against_transactions": names,
        "required_status": COUNTED_STATUS,
        "transactions_date_range": [lo, hi],
        "service_type_and_status_in_data": [
            {"service_type": st, "status": status, "rows": n, "amount": amt}
            for st, status, n, amt in combos
        ],
        "rows_after_each_filter": {
            "1_all_transactions": count(),
            "2_in_target_date_range": count(*in_range),
            "3_and_status_matches": count(*in_range, status_ok),
            "4_and_service_type_matches": count(*in_range, status_ok, type_ok),
            "5_and_agent_found_by_short_code": count(*in_range, status_ok, type_ok, join_agent=True),
        },
    }


# ---- period targets --------------------------------------------------------
def set_period_targets(db, target: ServiceTypeTarget, items: list[PeriodTargetIn], *, actor_id) -> None:
    # 1. validate everything before writing anything
    for i in items:
        if i.end_date < i.start_date:
            raise conflict(f"Period end {i.end_date} is before its start {i.start_date}")
        if i.start_date < target.start_date or i.end_date > target.end_date:
            raise conflict(
                f"Periods must be inside {target.start_date} to {target.end_date} "
                f"({i.start_date} to {i.end_date} is not)"
            )

    ordered = sorted(items, key=lambda i: i.start_date)
    for prev, cur in zip(ordered, ordered[1:]):
        if cur.start_date <= prev.end_date:
            raise conflict(
                f"Periods overlap: {prev.start_date} to {prev.end_date} and {cur.start_date} to {cur.end_date}"
            )

    total = sum((i.target_value for i in items), Decimal("0"))
    if total > target.target_value:
        raise conflict(
            f"Period targets total {total:,.2f}, which is more than the target {target.target_value:,.2f}"
        )

    # 2. write
    existing = {p.id: p for p in target.periods}
    keep = {i.id for i in items if i.id}

    for pid, row in existing.items():
        if pid not in keep:
            service_type_target_period_crud.soft_delete(db, row, actor_id=actor_id)

    for i in items:
        data = {"start_date": i.start_date, "end_date": i.end_date, "target_value": i.target_value}
        if i.id:
            row = existing.get(i.id)
            if row is None:
                raise conflict("Period does not belong to this target")
            service_type_target_period_crud.update(db, row, data, actor_id=actor_id)
        else:
            service_type_target_period_crud.create(
                db,
                {**data, "service_type_target_id": target.id},
                actor_id=actor_id,
            )