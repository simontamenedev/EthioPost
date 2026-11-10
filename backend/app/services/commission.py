"""Commission calculation, snapshotted onto each imported row.

Step 1  FSP commission = from CommissionRule (FLAT per txn, or PERCENT of amount)
Step 2  Split          = from CommissionRate (agent % of the FSP commission;
                         the remainder belongs to Ethio Post)

Example: amount 1000, FSP rule 2%  -> FSP pays 20.00
         CommissionRate 50%        -> agent 10.00, Ethio Post 10.00
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.datasets import Dataset
from app.models import (
    AgentTransaction,
    CommissionRate,
    CommissionRule,
    CustomerRegistration,
    CustomerUpgrade,
    ServiceType,
)

CENT = Decimal("0.01")
HUNDRED = Decimal(100)

# Registrations/upgrades have no "Service Type" column, so a fixed service name is used.
# These must match ServiceType.name (for rules) and CommissionRate.service_types (for splits).
FIXED_SERVICE = {
    Dataset.REGISTRATIONS: "Customer Registration",
    Dataset.UPGRADES: "Customer Upgrade",
}


def _money(v: Decimal) -> Decimal:
    return v.quantize(CENT, ROUND_HALF_UP)


def _val(x: Any) -> str | None:
    """Enum -> its value, anything else -> str, None stays None."""
    return None if x is None else str(getattr(x, "value", x))


class CommissionEngine:
    """Loads one provider's rules and all agent rates once per import."""

    def __init__(self, db: Session, fsp_id: uuid.UUID):
        self.fsp_id = fsp_id

        self.rules: dict[str, list[CommissionRule]] = defaultdict(list)
        q = (
            select(CommissionRule, ServiceType.name)
            .join(ServiceType, ServiceType.id == CommissionRule.service_type_id)
            .where(CommissionRule.fsp_id == fsp_id, CommissionRule.deleted_at.is_(None))
        )
        for rule, name in db.execute(q).all():
            self.rules[name.strip().lower()].append(rule)

        self.rates: dict[str, CommissionRate] = {}
        for rate in db.scalars(select(CommissionRate).where(CommissionRate.deleted_at.is_(None))):
            for st in rate.service_types or []:
                self.rates[st.strip().lower()] = rate

    # ------------------------------------------------------------------ lookup
    def _find_rule(
        self, service: str, day: date, unit_amount: Decimal | None, qualifier: str | None = None
    ) -> CommissionRule | None:
        cands = [
            r for r in self.rules.get(service.strip().lower(), [])
            if r.effective_from <= day
            and (r.effective_to is None or day <= r.effective_to)
            and (
                unit_amount is None
                or (
                    (r.min_amount is None or unit_amount >= r.min_amount)
                    and (r.max_amount is None or unit_amount <= r.max_amount)
                )
            )
        ]
        if qualifier:
            exact = [r for r in cands if r.qualifier and r.qualifier.lower() == qualifier.lower()]
            if exact:
                cands = exact
        else:
            cands = [r for r in cands if not r.qualifier]  # qualified rules need a matching value
        return max(cands, key=lambda r: r.effective_from) if cands else None

    # ------------------------------------------------------------------ calculation
    def calculate(self, ds: Dataset, v: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = dict(
            commission_rule_id=None, commission_rate_id=None,
            fsp_commission_type=None, fsp_commission_basis=None,
            fsp_commission_rate=None, fsp_commission_amount=None,
            agent_commission_rate=None, agent_commission_amount=None,
            ethiopost_commission_amount=None, commission_status=None,
        )

        amount: Decimal | None = None
        if ds == Dataset.TRANSACTIONS:
            service, day, count = v["service_type"], v["txn_date"], v["txn_count"]
            amount = v["total_amount"]
            if v["txn_status"] != "COMPLETED":
                out["commission_status"] = "NOT_ELIGIBLE"
                return out
        elif ds == Dataset.REGISTRATIONS:
            service, day, count = FIXED_SERVICE[ds], v["reg_date"], v["registration_count"]
        else:
            service, day, count = FIXED_SERVICE[ds], v["upgrade_date"], v["upgrade_count"]

        # Rows are daily aggregates: the amount band is checked against the average txn size.
        unit = (amount / count) if (amount is not None and count) else None
        rule = self._find_rule(service, day, unit)
        if rule is None:
            out["commission_status"] = "NO_RULE"
            return out

        out.update(
            commission_rule_id=rule.id,
            fsp_commission_type=_val(rule.commission_type),
            fsp_commission_basis=_val(rule.basis),
            fsp_commission_rate=rule.rate,
        )

        # ---- step 1: what the FSP pays
        if (_val(rule.commission_type) or "").upper() == "FLAT":
            fsp_amount = _money(rule.rate * count)
        else:  # PERCENT
            if amount is None:
                out["commission_status"] = "NO_BASE"      # percent rule, but this report has no amount
                return out
            if (_val(rule.basis) or "").lower() != "txn_amount":
                out["commission_status"] = "NEEDS_FEE"    # fee_collected is not in the CSV
                return out
            fsp_amount = _money(amount * rule.rate / HUNDRED)
        out["fsp_commission_amount"] = fsp_amount

        # ---- step 2: split between agent and Ethio Post
        rate = self.rates.get(service.strip().lower())
        if rate is None:
            out["commission_status"] = "NO_AGENT_RATE"
            return out
        agent_amount = _money(fsp_amount * rate.rate / HUNDRED)
        out.update(
            commission_rate_id=rate.id,
            agent_commission_rate=rate.rate,
            agent_commission_amount=agent_amount,
            ethiopost_commission_amount=fsp_amount - agent_amount,  # remainder: always sums exactly
            commission_status="CALCULATED",
        )
        return out


def apply_commission(db: Session, ds: Dataset, fsp_id: uuid.UUID, rows: list[dict[str, Any]]) -> None:
    """Mutates each row dict in place, adding the snapshot columns."""
    engine = CommissionEngine(db, fsp_id)
    for row in rows:
        row.update(engine.calculate(ds, row))


# ---------------------------------------------------------------------- backfill
_MODELS = {
    Dataset.TRANSACTIONS: AgentTransaction,
    Dataset.REGISTRATIONS: CustomerRegistration,
    Dataset.UPGRADES: CustomerUpgrade,
}
_INPUT_FIELDS = {
    Dataset.TRANSACTIONS: ("service_type", "txn_date", "txn_count", "total_amount", "txn_status"),
    Dataset.REGISTRATIONS: ("reg_date", "registration_count"),
    Dataset.UPGRADES: ("upgrade_date", "upgrade_count"),
}
# Statuses that never produced a full snapshot, so recalculating them breaks no history.
_UNRESOLVED = ("NO_RULE", "NO_AGENT_RATE", "NEEDS_FEE", "NO_BASE")


def backfill_commission(
    db: Session,
    *,
    fsp_id: uuid.UUID | None = None,
    retry_unresolved: bool = True,
    chunk: int = 1000,
) -> dict[str, dict[str, int]]:
    """Calculate commission for rows that have none yet (commission_status IS NULL).

    Rows already CALCULATED or NOT_ELIGIBLE are never touched, so old snapshots stay
    frozen. With retry_unresolved=True, rows stuck at NO_RULE / NO_AGENT_RATE / ...
    are tried again (useful after you add rules or rates).
    Returns {dataset: {"processed": n, "calculated": n}}. Commits once at the end.
    """
    result: dict[str, dict[str, int]] = {}
    engines: dict[uuid.UUID, CommissionEngine] = {}
    try:
        for ds, model in _MODELS.items():
            fields = _INPUT_FIELDS[ds]
            status_col = model.commission_status
            todo = status_col.is_(None)
            if retry_unresolved:
                todo = or_(todo, status_col.in_(_UNRESOLVED))

            processed = calculated = 0
            last_id: uuid.UUID | None = None
            while True:
                stmt = select(model).where(model.deleted_at.is_(None), todo)
                if fsp_id:
                    stmt = stmt.where(model.fsp_id == fsp_id)
                if last_id:
                    stmt = stmt.where(model.id > last_id)  # keyset paging: unresolved rows stay in the filter
                rows = list(db.scalars(stmt.order_by(model.id).limit(chunk)))
                if not rows:
                    break
                for row in rows:
                    engine = engines.get(row.fsp_id)
                    if engine is None:
                        engine = engines[row.fsp_id] = CommissionEngine(db, row.fsp_id)
                    snap = engine.calculate(ds, {f: getattr(row, f) for f in fields})
                    for k, val in snap.items():
                        setattr(row, k, val)
                    processed += 1
                    calculated += snap["commission_status"] == "CALCULATED"
                last_id = rows[-1].id
                db.flush()
            result[ds.value] = {"processed": processed, "calculated": calculated}
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result