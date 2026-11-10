"""Ethio Post dashboard: one date range, every number from the stored commission snapshots."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, func, literal_column, select, union_all
from sqlalchemy.orm import Session

from app.core.datasets import Dataset
from app.models import Agent, Branch, District, FinancialServiceProvider
from app.services.analytics import SPECS, DataFilters, previous_period

_ZERO = literal_column("0")
_NAMES = ("fsp_id", "agent_id", "agent_shortcode", "organization_name", "day",
          "fsp_comm", "agent_comm", "ethi_comm", "amount", "txns", "registrations", "upgrades")


def _num(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def _row(r) -> dict[str, Any]:
    return {k: _num(v) for k, v in r._mapping.items()}


def _sum(col):
    return func.coalesce(func.sum(col), 0)


def _facts(f: DataFilters):
    """All three datasets as one table with common columns, already date/provider filtered."""
    parts = []
    for ds, spec in SPECS.items():
        m = spec.model
        day = getattr(m, spec.date_attr)
        cols = {
            "fsp_id": m.fsp_id,
            "agent_id": m.agent_id,
            "agent_shortcode": m.agent_shortcode,
            "organization_name": m.organization_name,
            "day": day,
            "fsp_comm": m.fsp_commission_amount,
            "agent_comm": m.agent_commission_amount,
            "ethi_comm": m.ethiopost_commission_amount,
            "amount": m.total_amount if ds == Dataset.TRANSACTIONS else _ZERO,
            "txns": m.txn_count if ds == Dataset.TRANSACTIONS else _ZERO,
            "registrations": m.registration_count if ds == Dataset.REGISTRATIONS else _ZERO,
            "upgrades": m.upgrade_count if ds == Dataset.UPGRADES else _ZERO,
        }
        q = select(*[cols[n].label(n) for n in _NAMES]).where(m.deleted_at.is_(None))
        if f.date_from:
            q = q.where(day >= f.date_from)
        if f.date_to:
            q = q.where(day <= f.date_to)
        if f.fsp_id:
            q = q.where(m.fsp_id == f.fsp_id)
        parts.append(q)
    return union_all(*parts).subquery("facts")


def _totals(db: Session, facts) -> dict[str, Any]:
    row = db.execute(
        select(
            _sum(facts.c.fsp_comm).label("fsp_commission"),
            _sum(facts.c.agent_comm).label("agent_commission"),
            _sum(facts.c.ethi_comm).label("ethiopost_commission"),
            _sum(facts.c.amount).label("amount"),
            _sum(facts.c.txns).label("txns"),
            _sum(facts.c.registrations).label("registrations"),
            _sum(facts.c.upgrades).label("upgrades"),
            func.count(func.distinct(facts.c.agent_shortcode)).label("active_agents"),
        ).select_from(facts)
    ).one()
    return _row(row)


def _active_entities(db: Session, facts) -> dict[str, int]:
    """Branches/districts that had activity in the period (linked agents only)."""
    linked = select(facts.c.agent_id).where(facts.c.agent_id.is_not(None)).distinct()
    row = db.execute(
        select(
            func.count(Agent.id),
            func.count(func.distinct(Agent.branch_id)),
            func.count(func.distinct(Agent.district_id)),
        ).where(Agent.id.in_(linked))
    ).one()
    return {"linked_agents": row[0], "branches": row[1], "districts": row[2]}


def _by_fsp(db: Session, facts) -> list[dict[str, Any]]:
    stmt = (
        select(
            facts.c.fsp_id.label("fsp_id"),
            FinancialServiceProvider.name.label("fsp_name"),
            _sum(facts.c.fsp_comm).label("fsp_commission"),
            _sum(facts.c.agent_comm).label("agent_commission"),
            _sum(facts.c.ethi_comm).label("ethiopost_commission"),
            _sum(facts.c.amount).label("amount"),
            _sum(facts.c.txns).label("txns"),
            _sum(facts.c.registrations).label("registrations"),
            _sum(facts.c.upgrades).label("upgrades"),
            func.count(func.distinct(facts.c.agent_shortcode)).label("active_agents"),
            func.count().label("records"),
        )
        .select_from(facts)
        .join(FinancialServiceProvider, FinancialServiceProvider.id == facts.c.fsp_id)
        .group_by(facts.c.fsp_id, FinancialServiceProvider.name)
        .order_by(desc("ethiopost_commission"))
    )
    return [_row(r) for r in db.execute(stmt)]


def _top_per_fsp(db: Session, facts, *, by: str, n: int) -> list[dict[str, Any]]:
    """Top-n agents or districts per provider, ranked by Ethio Post commission."""
    if by == "agent":
        key = facts.c.agent_shortcode
        base = select(
            facts.c.fsp_id.label("fsp_id"), key.label("key"),
            func.max(facts.c.organization_name).label("label"),
        ).select_from(facts)
    else:
        key = func.coalesce(District.name, "Unassigned")
        base = (
            select(facts.c.fsp_id.label("fsp_id"), key.label("key"), key.label("label"))
            .select_from(facts)
            .outerjoin(Agent, Agent.id == facts.c.agent_id)
            .outerjoin(District, District.id == Agent.district_id)
        )

    grouped = (
        base.add_columns(
            _sum(facts.c.ethi_comm).label("ethiopost"),
            _sum(facts.c.agent_comm).label("agent"),
            _sum(facts.c.fsp_comm).label("fsp"),
            func.count().label("records"),
        ).group_by(facts.c.fsp_id, key)
    ).subquery()
    ranked = select(
        grouped,
        func.row_number().over(
            partition_by=grouped.c.fsp_id, order_by=desc(grouped.c.ethiopost)
        ).label("rn"),
    ).subquery()
    rows = db.execute(
        select(ranked).where(ranked.c.rn <= n).order_by(ranked.c.fsp_id, ranked.c.rn)
    )
    return [{k: v for k, v in _row(r).items() if k != "rn"} for r in rows]


def _top_overall(db: Session, facts, *, by: str, n: int) -> list[dict[str, Any]]:
    """Top-n agents / branches / districts across all providers, by Ethio Post commission."""
    if by == "agent":
        key = facts.c.agent_shortcode
        base = select(
            key.label("key"), func.max(facts.c.organization_name).label("label")
        ).select_from(facts)
    else:
        model = Branch if by == "branch" else District
        key = func.coalesce(model.name, "Unassigned")
        base = (
            select(key.label("key"), key.label("label"))
            .select_from(facts)
            .outerjoin(Agent, Agent.id == facts.c.agent_id)
        )
        if by == "branch":
            base = base.outerjoin(Branch, Branch.id == Agent.branch_id)
        else:
            base = base.outerjoin(District, District.id == Agent.district_id)

    stmt = (
        base.add_columns(
            _sum(facts.c.ethi_comm).label("ethiopost"),
            _sum(facts.c.agent_comm).label("agent"),
            _sum(facts.c.fsp_comm).label("fsp"),
            func.count().label("records"),
        )
        .group_by(key)
        .order_by(desc("ethiopost"))
        .limit(n)
    )
    return [_row(r) for r in db.execute(stmt)]


def _daily(db: Session, facts) -> list[dict[str, Any]]:
    stmt = (
        select(
            facts.c.day.label("period"),
            _sum(facts.c.ethi_comm).label("ethiopost"),
            _sum(facts.c.agent_comm).label("agent"),
            _sum(facts.c.fsp_comm).label("fsp"),
        )
        .select_from(facts)
        .group_by(facts.c.day)
        .order_by(facts.c.day)
    )
    return [
        {"period": r.period.isoformat(), "ethiopost": _num(r.ethiopost),
         "agent": _num(r.agent), "fsp": _num(r.fsp)}
        for r in db.execute(stmt)
    ]


def dashboard_overview(db: Session, f: DataFilters, *, top: int = 5) -> dict[str, Any]:
    facts = _facts(f)
    totals = _totals(db, facts)
    pf = previous_period(f)
    previous = _totals(db, _facts(pf)) if pf else None
    change = None
    if previous:
        change = {
            k: (round((totals[k] - previous[k]) / previous[k] * 100, 1) if previous[k] else None)
            for k in totals
        }
    return {
        "totals": totals,
        "previous": previous,
        "change_pct": change,
        "active": {"agents": totals["active_agents"], **_active_entities(db, facts)},
        "by_fsp": _by_fsp(db, facts),
        "top_agents": _top_per_fsp(db, facts, by="agent", n=top),
        "top_districts": _top_per_fsp(db, facts, by="district", n=top),
        "overall": {
            "agents": _top_overall(db, facts, by="agent", n=top),
            "branches": _top_overall(db, facts, by="branch", n=top),
            "districts": _top_overall(db, facts, by="district", n=max(top, 20)),
        },
        "daily": _daily(db, facts),
    }