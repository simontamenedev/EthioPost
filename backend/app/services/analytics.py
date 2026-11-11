"""Date-range dashboards, advanced filtering and export queries.

One registry (SPECS) describes each dataset; every function below is generic over it,
so adding a fourth report type means adding one registry entry.
All user-supplied column names are whitelisted through the registry (no raw SQL).
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import ColumnElement, Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.datasets import Dataset
from app.models import (
    Agent,
    AgentTransaction,
    Branch,
    CustomerRegistration,
    CustomerUpgrade,
    District,
)

MAX_EXPORT_ROWS = 100_000

# Commission measures (all summed from the snapshot columns stored on each row).
_COMM = {
    "fsp_commission": "fsp_commission_amount",
    "agent_commission": "agent_commission_amount",
    "ethiopost_commission": "ethiopost_commission_amount",
}
_COMM_EXPORT = (
    "commission_status",
    "fsp_commission_type",   # add this
    "fsp_commission_rate",
    "commission_status",
    "fsp_commission_rate",
    "fsp_commission_amount",
    "agent_commission_rate",
    "agent_commission_amount",
    "ethiopost_commission_amount",
)


@dataclass(frozen=True)
class DatasetSpec:
    model: type
    date_attr: str
    measures: dict[str, str]  # output name -> column that is SUMmed
    dimensions: tuple[str, ...]  # columns usable for group_by / breakdown (plus agent, branch, district)
    sort_fields: tuple[str, ...]
    export_columns: tuple[str, ...]
    status_attr: str | None = None  # column the generic ?status= filter applies to


SPECS: dict[Dataset, DatasetSpec] = {
    Dataset.TRANSACTIONS: DatasetSpec(
        AgentTransaction, "txn_date",
        {"txn_count": "txn_count", "amount": "total_amount", **_COMM},
        ("service_type", "channel", "region", "txn_status", "commission_status"),
        ("txn_date", "total_amount", "txn_count", "service_type", "agent_shortcode", "region", "created_at",
         "fsp_commission_amount", "agent_commission_amount", "ethiopost_commission_amount"),
        ("txn_date", "agent_shortcode", "organization_name", "region", "service_type", "channel",
         "txn_status", "debit_shortcode", "credit_shortcode", "txn_count", "total_amount",
         "failure_reason", *_COMM_EXPORT),
        status_attr="txn_status",
    ),
    Dataset.REGISTRATIONS: DatasetSpec(
        CustomerRegistration, "reg_date",
        {"registrations": "registration_count", **_COMM},
        ("customer_status", "region", "commission_status"),
        ("reg_date", "registration_count", "customer_status", "agent_shortcode", "region", "created_at",
         "fsp_commission_amount", "agent_commission_amount", "ethiopost_commission_amount"),
        ("reg_date", "agent_shortcode", "organization_name", "region", "customer_status",
         "registration_count", *_COMM_EXPORT),
        status_attr="customer_status",
    ),
    Dataset.UPGRADES: DatasetSpec(
        CustomerUpgrade, "upgrade_date",
        {"upgrades": "upgrade_count", **_COMM},
        ("before_level", "after_level", "region", "commission_status"),
        ("upgrade_date", "upgrade_count", "before_level", "after_level", "agent_shortcode", "region",
         "created_at", "fsp_commission_amount", "agent_commission_amount", "ethiopost_commission_amount"),
        ("upgrade_date", "agent_shortcode", "organization_name", "region", "upgrade_at",
         "before_level", "after_level", "upgrade_count", *_COMM_EXPORT),
    ),
}


@dataclass(frozen=True)
class DataFilters:
    date_from: date | None = None
    date_to: date | None = None
    agent_shortcode: str | None = None
    region: str | None = None
    district_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    batch_id: uuid.UUID | None = None
    service_type: str | None = None  # transactions only
    channel: str | None = None  # transactions only
    status: str | None = None  # txn_status / customer_status
    before_level: str | None = None  # upgrades only
    after_level: str | None = None  # upgrades only
    min_amount: Decimal | None = None  # transactions only
    max_amount: Decimal | None = None  # transactions only
    q: str | None = None  # free text on organization name / short code
    fsp_id: uuid.UUID | None = None   # provider
    district: str | None = None       # district name


# --------------------------------------------------------------------------- query building
def _num(v: Any) -> Any:
    return float(v) if isinstance(v, Decimal) else v


def _from(spec: DatasetSpec, stmt: Select) -> Select:
    m = spec.model
    return (
        stmt.select_from(m)
        .outerjoin(Agent, Agent.id == m.agent_id)
        .outerjoin(Branch, Branch.id == Agent.branch_id)
        .outerjoin(District, District.id == Agent.district_id)
    )


def _conditions(spec: DatasetSpec, f: DataFilters) -> list[ColumnElement[bool]]:
    m = spec.model
    day = getattr(m, spec.date_attr)
    c: list[ColumnElement[bool]] = [m.deleted_at.is_(None)]
    if f.date_from:
        c.append(day >= f.date_from)
    if f.date_to:
        c.append(day <= f.date_to)
    if f.agent_shortcode:
        c.append(m.agent_shortcode == f.agent_shortcode)
    if f.region:
        c.append(m.region == f.region)
    if f.district_id:
        c.append(Agent.district_id == f.district_id)
    if f.branch_id:
        c.append(Agent.branch_id == f.branch_id)
    if f.fsp_id:
        c.append(m.fsp_id == f.fsp_id)
    if f.district:
        c.append(District.name == f.district)    
    if f.batch_id:
        c.append(m.import_batch_id == f.batch_id)
    if f.q:
        like = f"%{f.q.strip()}%"
        c.append(or_(m.organization_name.ilike(like), m.agent_shortcode.ilike(like)))
    if f.status and spec.status_attr:
        c.append(getattr(m, spec.status_attr) == f.status)
    for name in ("service_type", "channel", "before_level", "after_level"):
        value = getattr(f, name)
        if value and hasattr(m, name):
            c.append(getattr(m, name) == value)
    if hasattr(m, "total_amount"):
        if f.min_amount is not None:
            c.append(m.total_amount >= f.min_amount)
        if f.max_amount is not None:
            c.append(m.total_amount <= f.max_amount)
    return c


def _q(spec: DatasetSpec, stmt: Select, f: DataFilters) -> Select:
    return _from(spec, stmt).where(*_conditions(spec, f))


def _measure_cols(spec: DatasetSpec) -> list[ColumnElement]:
    return [
        func.coalesce(func.sum(getattr(spec.model, col)), 0).label(name)
        for name, col in spec.measures.items()
    ]


def _dimension(spec: DatasetSpec, name: str) -> ColumnElement:
    if name == "agent":
        return spec.model.agent_shortcode
    if name == "branch":
        return func.coalesce(Branch.name, "Unassigned")
    if name == "district":
        return func.coalesce(District.name, "Unassigned")
    if name in spec.dimensions:
        return getattr(spec.model, name)
    raise ValueError(f"Unknown dimension '{name}'")


def valid_dimensions(ds: Dataset) -> tuple[str, ...]:
    return ("agent", "branch", "district", *SPECS[ds].dimensions)


# --------------------------------------------------------------------------- reads
def list_rows(
    db: Session, ds: Dataset, f: DataFilters, *, sort: str | None, order: str, skip: int, limit: int
):
    spec = SPECS[ds]
    m = spec.model
    col = getattr(m, sort) if sort in spec.sort_fields else getattr(m, spec.date_attr)
    direction = asc if order == "asc" else desc
    total = db.scalar(_q(spec, select(func.count()), f)) or 0
    stmt = _q(spec, select(m), f).order_by(direction(col), m.id).offset(skip).limit(limit)
    return list(db.scalars(stmt)), total


def summary(db: Session, ds: Dataset, f: DataFilters) -> dict[str, Any]:
    spec = SPECS[ds]
    cols = [*_measure_cols(spec),
            func.count(func.distinct(spec.model.agent_shortcode)).label("active_agents"),
            func.count().label("rows")]
    row = db.execute(_q(spec, select(*cols), f)).one()
    return {k: _num(v) for k, v in row._mapping.items()}


def previous_period(f: DataFilters) -> DataFilters | None:
    """Same-length window immediately before the selected one (for % change cards)."""
    if not (f.date_from and f.date_to):
        return None
    days = (f.date_to - f.date_from).days + 1
    prev_to = f.date_from - timedelta(days=1)
    return replace(f, date_from=prev_to - timedelta(days=days - 1), date_to=prev_to)


def summary_with_previous(db: Session, ds: Dataset, f: DataFilters) -> dict[str, Any]:
    current = summary(db, ds, f)
    pf = previous_period(f)
    previous = summary(db, ds, pf) if pf else None
    change: dict[str, float | None] = {}
    if previous:
        for k in (*SPECS[ds].measures, "active_agents"):
            prev = previous[k]
            change[k] = round((current[k] - prev) / prev * 100, 1) if prev else None
    return {"current": current, "previous": previous, "change_pct": change or None}


def overview(db: Session, f: DataFilters) -> dict[str, Any]:
    return {ds.value: summary_with_previous(db, ds, f) for ds in SPECS}


def _bucket(d: date, interval: str) -> date:
    if interval == "week":
        return d - timedelta(days=d.weekday())  # Monday
    if interval == "month":
        return d.replace(day=1)
    return d


def timeseries(
    db: Session, ds: Dataset, f: DataFilters, *, interval: str = "day", group_by: str | None = None
) -> list[dict[str, Any]]:
    spec = SPECS[ds]
    day = getattr(spec.model, spec.date_attr)
    key = _dimension(spec, group_by).label("key") if group_by else None
    cols = [day.label("period"), *_measure_cols(spec)] + ([key] if key is not None else [])
    stmt = _q(spec, select(*cols), f).group_by(day, *([key] if key is not None else [])).order_by(day)

    acc: dict[tuple[date, Any], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for row in db.execute(stmt):
        r = row._mapping
        bucket = acc[(_bucket(r["period"], interval), r["key"] if key is not None else None)]
        for name in spec.measures:
            bucket[name] += float(r[name])
    out = []
    for (period, k), measures in sorted(acc.items(), key=lambda kv: (kv[0][0], str(kv[0][1]))):
        item: dict[str, Any] = {"period": period.isoformat(), **{n: round(v, 2) for n, v in measures.items()}}
        if group_by:
            item["key"] = k
        out.append(item)
    return out


def breakdown(
    db: Session, ds: Dataset, f: DataFilters, *, dimension: str, limit: int = 20
) -> list[dict[str, Any]]:
    spec = SPECS[ds]
    key = _dimension(spec, dimension)
    label = func.max(spec.model.organization_name) if dimension == "agent" else key
    measures = _measure_cols(spec)
    primary = next(iter(spec.measures))
    stmt = (
        _q(spec, select(key.label("key"), label.label("label"), *measures), f)
        .group_by(key)
        .order_by(desc(func.sum(getattr(spec.model, spec.measures[primary]))))
        .limit(limit)
    )
    return [{k: _num(v) for k, v in row._mapping.items()} for row in db.execute(stmt)]


def filter_options(db: Session) -> dict[str, list[str]]:
    t, r, u = AgentTransaction, CustomerRegistration, CustomerUpgrade

    def values(model, col) -> set[str]:
        return {v for v in db.scalars(select(col).where(model.deleted_at.is_(None)).distinct()) if v}

    return {
        "regions": sorted(values(t, t.region) | values(r, r.region) | values(u, u.region)),
        "service_types": sorted(values(t, t.service_type)),
        "channels": sorted(values(t, t.channel)),
        "transaction_statuses": sorted(values(t, t.txn_status)),
        "customer_statuses": sorted(values(r, r.customer_status)),
        "before_levels": sorted(values(u, u.before_level)),
        "after_levels": sorted(values(u, u.after_level)),
        "commission_statuses": sorted(
            values(t, t.commission_status) | values(r, r.commission_status) | values(u, u.commission_status)
        ),
        "districts": sorted(
            n for n in db.scalars(select(District.name).where(District.deleted_at.is_(None))) if n
        ),
    }


def export_rows(db: Session, ds: Dataset, f: DataFilters) -> tuple[list[str], list[tuple], bool]:
    """Returns (headers, rows, truncated). Branch and district names are added to every export."""
    spec = SPECS[ds]
    m = spec.model
    cols = [getattr(m, c) for c in spec.export_columns]
    stmt = (
        _q(spec, select(*cols, Branch.name, District.name), f)
        .order_by(getattr(m, spec.date_attr), m.agent_shortcode, m.id)
        .limit(MAX_EXPORT_ROWS + 1)
    )
    rows = [tuple(r) for r in db.execute(stmt)]
    return [*spec.export_columns, "branch", "district"], rows[:MAX_EXPORT_ROWS], len(rows) > MAX_EXPORT_ROWS