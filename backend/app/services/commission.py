"""Commission lookup used by the CSV import and the one-off backfill."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session

from app.core.enums import Status
from app.models import AgentTransaction, CommissionRate

# Only completed transactions earn commission (failed ones get 0.00).
COMMISSION_STATUS = "COMPLETED"


def rate_lookup(db: Session) -> dict[str, CommissionRate]:
    """lower-cased CSV service type -> active commission rate."""
    rates = db.scalars(
        select(CommissionRate).where(
            CommissionRate.deleted_at.is_(None), CommissionRate.status == Status.ACTIVE
        )
    ).all()
    return {t.strip().lower(): r for r in rates for t in (r.service_types or [])}


def apply_commission(rows: list[dict[str, Any]], lookup: dict[str, CommissionRate]) -> None:
    """Stamp rate + commission on parsed transaction rows. Runs AFTER row_hash is computed,
    so a rate change never alters row identity (re-uploads stay idempotent)."""
    for v in rows:
        rate = lookup.get(v["service_type"].strip().lower())
        if rate is None:
            v["commission_rate_id"] = v["commission_rate"] = v["commission_amount"] = None
            continue
        v["commission_rate_id"] = rate.id
        v["commission_rate"] = rate.rate
        v["commission_amount"] = (
            (v["total_amount"] * rate.rate / Decimal(100)).quantize(Decimal("0.01"))
            if v["txn_status"] == COMMISSION_STATUS
            else Decimal("0.00")
        )


def backfill_commission(db: Session) -> int:
    """Fill rows imported before commission existed. Never overwrites an existing snapshot.
    Note: these rows get TODAY's rate, since the historical one was never recorded."""
    updated = 0
    for key, rate in rate_lookup(db).items():
        res = db.execute(
            update(AgentTransaction)
            .where(
                func.lower(AgentTransaction.service_type) == key,
                AgentTransaction.commission_rate.is_(None),
                AgentTransaction.deleted_at.is_(None),
            )
            .values(
                commission_rate_id=rate.id,
                commission_rate=rate.rate,
                commission_amount=case(
                    (
                        AgentTransaction.txn_status == COMMISSION_STATUS,
                        func.round(AgentTransaction.total_amount * rate.rate / 100, 2),
                    ),
                    else_=0,
                ),
            )
        )
        updated += res.rowcount or 0
    db.commit()
    return updated