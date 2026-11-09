"""Seed agent commission rates from the Ethiopost DFS Agent Commission Sheet.

Usage:
    python -m scripts.seed_commission_rates               # insert any missing rates
    python -m scripts.seed_commission_rates --backfill    # also stamp old transactions

Existing rates are never overwritten, so edits made in the app are kept.
"""
import argparse
from decimal import Decimal

from sqlalchemy import func, select

from app.core.audit_context import request_ctx
from app.core.enums import UserRole
from app.crud import commission_rate_crud
from app.db.session import SessionLocal
from app.models import CommissionRate, User
from app.services.commission import backfill_commission

# (service name, percent, CSV "Service Type" values it applies to)
RATES: list[tuple[str, int, list[str] | None]] = [
    ("Cash-In / Cash-Out Services", 50, ["Cash In", "Cash Out"]),
    ("Domestic Remittance Services/P2P", 40, None),
    ("International Remittances", 40, None),
    ("Digital Wallet Opening", 50, None),
    ("Bank Account Opening", 50, None),
    ("Micro-Savings", 50, None),
    ("Utility Bill Payment Services", 50, ["Bill Payment"]),
    ("Government-to-Person/Person-Government (G2P/P2G) Payments", 50, None),
    ("Humanitarian Cash Transfer Programs (NGO Funded)", 50, None),
    ("Educational Grants and Student Stipends", 40, None),
    ("Agricultural Input Voucher Disbursement", 50, None),
    ("Micro and Nano Loans", 40, None),
    ("Pay-As-You-Go (PAYG) Asset Financing", 30, None),
    ("Digital Group Lending / Cooperative Lending", 50, None),
    ("Microinsurance/Insurance Premium Collection", 40, None),
    ("Insurance Claims Disbursement", 40, None),
    ("Merchant Payment Acceptance-Onboarding", 40, None),
    ("MSME Working Capital Lending", 40, None),
    ("Digital School Fee Collection", 30, None),
    ("GVT Health Insurance & Co-Payment Collection", 50, None),
    ("Digital Donations / Crowdfunding", 50, None),
    ("Birth, Marriage, and Death Certificate Fee Collection", 50, None),
    ("Airtime Top-Up (Including EVD)", 50, ["Airtime Top Up"]),
    ("Sim Card Distribution-Sales", 40, None),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true", help="stamp existing transactions that have no rate")
    args = parser.parse_args()

    request_ctx.set({"ip_address": None, "user_agent": "seed_commission_rates"})  # the audit log reads this

    with SessionLocal() as db:
        admin = db.scalars(
            select(User)
            .where(User.role == UserRole.ADMIN, User.deleted_at.is_(None))
            .order_by(User.created_at)
        ).first()
        if admin is None:
            raise SystemExit("No admin user found. Run `python -m scripts.create_admin` first.")

        existing = {
            n.lower()
            for n in db.scalars(
                select(func.lower(CommissionRate.service_name)).where(CommissionRate.deleted_at.is_(None))
            )
        }

        created = skipped = 0
        for name, rate, types in RATES:
            if name.lower() in existing:
                skipped += 1
                continue
            commission_rate_crud.create(
                db,
                {
                    "service_name": name,
                    "rate": Decimal(rate),
                    "service_types": types,
                    "remark": "To be calculated from Ethiopost's DFS Product/Service Gross Revenue",
                },
                actor_id=admin.id,
            )
            created += 1
        print(f"Commission rates: {created} created, {skipped} already existed.")

        if args.backfill:
            print(f"Backfilled {backfill_commission(db):,} existing transactions.")


if __name__ == "__main__":
    main()