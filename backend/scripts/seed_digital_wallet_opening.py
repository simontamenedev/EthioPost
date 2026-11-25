"""Add the "Digital Wallet Opening" service type.

Usage:
    python -m scripts.seed_digital_wallet_opening             # insert
    python -m scripts.seed_digital_wallet_opening --dry-run   # show what would happen, write nothing

What it does (nothing existing is edited or overwritten):
  1. Creates the service type DIGITAL_WALLET_OPENING (if missing).
  2. Adds one FLAT commission rule per provider (Ahadu E-Birr 17, Awash 18, CBE Birr 17, Telebirr 18).
  3. Creates a 50% agent commission rate for it (a service type can be in only one rate).
  4. Links it to the existing target "Digital Wallet Account Opening and Management Nov-26 to Jun-27".

Safe to re-run: every step is skipped if it already exists.

Check these (the judgement calls):
  * "ebirr" is taken as AHADU (Ahadu E-Birr). Change to "COOP" if you meant COOP E-Birr.
  * CSV_LABEL is None, like Customer Registration, so it is NOT matched against transactions
    in the performance view. Set it to the transaction report's "Service Type" text if
    wallet openings appear there and should count towards the target.
  * The rate gets its own name so the existing "Digital Wallet Opening" 50% rate is untouched.
"""
import sys
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select

from app.core.audit_context import request_ctx
from app.core.enums import CommissionType, Status, UserRole
from app.crud import commission_rate_crud
from app.crud.base import CRUDBase
from app.db.session import SessionLocal
from app.models import (
    CommissionRate,
    CommissionRule,
    FinancialServiceProvider,
    ServiceType,
    ServiceTypeTarget,
    ServiceTypeTargetItem,
    User,
)
from app.models.commission_rate import commission_rate_service_types as link
from app.services.service_target_service import overlapping_service_type_names

CODE = "DIGITAL_WALLET_OPENING"
NAME = "Digital Wallet Opening"
CSV_LABEL: str | None = None

EFFECTIVE_FROM = date(2026, 3, 19)  # same date as the commission sheet used by seed_commission_rules

# provider code -> ETB per wallet opening
FSP_RATES: dict[str, Decimal] = {
    "AHADU": Decimal("17"),   # Ahadu E-Birr
    "AWASH": Decimal("18"),
    "CBE_BIRR": Decimal("17"),
    "TELEBIRR": Decimal("18"),
}
FSP_NAMES = {
    "AHADU": "Ahadu E-Birr",
    "AWASH": "Awash Birr",
    "CBE_BIRR": "CBE Birr",
    "TELEBIRR": "Telebirr",
}

RATE_NAME = "Digital Wallet Opening (Wallet Account Opening)"
RATE_PERCENT = Decimal("50")
RATE_REMARK = "To be calculated from Ethiopost's DFS Product/Service Gross Revenue"

TARGET_NAME_PREFIX = "Digital Wallet Account Opening and Management"

item_crud = CRUDBase(ServiceTypeTargetItem)


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    request_ctx.set({"ip_address": None, "user_agent": "seed_digital_wallet_opening"})

    with SessionLocal() as db:
        admin = db.scalars(
            select(User).where(User.role == UserRole.ADMIN, User.deleted_at.is_(None)).order_by(User.created_at)
        ).first()
        if admin is None:
            raise SystemExit("No admin user found. Run `python -m scripts.create_admin` first.")

        # 1. service type
        st = db.scalars(
            select(ServiceType).where(ServiceType.code == CODE, ServiceType.deleted_at.is_(None))
        ).first()
        if st is None:
            st = ServiceType(code=CODE, name=NAME, csv_label=CSV_LABEL, status=Status.ACTIVE)
            db.add(st)
            db.flush()
            print(f"Created service type {CODE}")
        else:
            print(f"Service type {CODE} already exists")

        # 2. commission rules, one per provider
        added = skipped = 0
        for fsp_code, amount in FSP_RATES.items():
            fsp = db.scalars(
                select(FinancialServiceProvider).where(
                    FinancialServiceProvider.code == fsp_code, FinancialServiceProvider.deleted_at.is_(None)
                )
            ).first()
            if fsp is None:
                fsp = FinancialServiceProvider(code=fsp_code, name=FSP_NAMES[fsp_code], status=Status.ACTIVE)
                db.add(fsp)
                db.flush()
                print(f"Created provider {fsp_code}")

            exists = db.scalars(
                select(CommissionRule).where(
                    CommissionRule.fsp_id == fsp.id,
                    CommissionRule.service_type_id == st.id,
                    CommissionRule.qualifier.is_(None),
                    CommissionRule.min_amount.is_(None),
                    CommissionRule.max_amount.is_(None),
                    CommissionRule.effective_from == EFFECTIVE_FROM,
                    CommissionRule.deleted_at.is_(None),
                )
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(
                CommissionRule(
                    fsp_id=fsp.id,
                    service_type_id=st.id,
                    qualifier=None,
                    min_amount=None,
                    max_amount=None,
                    commission_type=CommissionType.FLAT,
                    basis=None,
                    rate=amount,
                    conditions="For each new successful wallet opening",
                    effective_from=EFFECTIVE_FROM,
                    status=Status.ACTIVE,
                )
            )
            added += 1
        print(f"Commission rules: {added} added, {skipped} skipped.")

        # 3. agent commission rate (50%)
        rate_exists = db.scalars(
            select(CommissionRate).where(
                func.lower(CommissionRate.service_name) == RATE_NAME.lower(),
                CommissionRate.deleted_at.is_(None),
            )
        ).first()
        taken_by = db.scalars(
            select(CommissionRate.service_name)
            .join(link, link.c.commission_rate_id == CommissionRate.id)
            .where(link.c.service_type_id == st.id, CommissionRate.deleted_at.is_(None))
        ).first()
        if rate_exists or taken_by:
            print(f"Commission rate: skipped, '{taken_by or RATE_NAME}' already covers this service type.")
        else:
            commission_rate_crud.create(
                db,
                {
                    "service_name": RATE_NAME,
                    "rate": RATE_PERCENT,
                    "service_types": [st],
                    "remark": RATE_REMARK,
                },
                actor_id=admin.id,
            )
            print(f"Commission rate: created '{RATE_NAME}' at {RATE_PERCENT}%.")

        # 4. link to the existing target
        target = db.scalars(
            select(ServiceTypeTarget)
            .where(
                ServiceTypeTarget.name.like(f"{TARGET_NAME_PREFIX}%"),
                ServiceTypeTarget.deleted_at.is_(None),
            )
            .order_by(ServiceTypeTarget.start_date)
        ).first()
        if target is None:
            print(f"Target: '{TARGET_NAME_PREFIX}' not found. Run `python -m scripts.seed_service_targets` first.")
        elif st.id in {s.id for s in target.service_types}:
            print(f"Target: '{target.name}' already includes {CODE}.")
        else:
            taken = overlapping_service_type_names(
                db, {st.id}, target.start_date, target.end_date, exclude_target_id=target.id
            )
            if taken:
                print(f"Target: skipped, already in another overlapping target: {', '.join(taken)}")
            else:
                item_crud.create(
                    db,
                    {"service_type_target_id": target.id, "service_type_id": st.id},
                    actor_id=admin.id,
                )
                print(f"Target: linked {CODE} to '{target.name}'.")

        if dry_run:
            db.rollback()
            print("[dry run] nothing was written.")
        else:
            db.commit()


if __name__ == "__main__":
    main()
