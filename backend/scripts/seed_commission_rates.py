"""Seed agent commission rates from the Ethiopost DFS Agent Commission Sheet.

Usage:
    python -m scripts.seed_commission_rates               # insert any missing rates
    python -m scripts.seed_commission_rates --backfill    # also stamp old rows with no commission

Existing rates are never overwritten, so edits made in the app are kept.
Each rate links to one or more ServiceType rows (matched by code, then CSV label; created if
missing). A service type can belong to only one rate, so a type already used by another rate
is skipped with a warning.
"""
import argparse
from decimal import Decimal

from sqlalchemy import func, select

from app.core.audit_context import request_ctx
from app.core.enums import Status, UserRole
from app.crud import commission_rate_crud
from app.db.session import SessionLocal
from app.models import CommissionRate, ServiceType, User
from app.models.commission_rate import commission_rate_service_types as link
from app.services.commission import backfill_commission

# code -> (name, csv_label). The first group matches scripts/seed_commission_rules.py;
# the second group are products from the agent commission sheet that have no rules yet.
SERVICE_TYPES: dict[str, tuple[str, str | None]] = {
    "CASH_IN": ("Cash In", "Cash In"),
    "CASH_OUT": ("Cash Out", "Cash Out"),
    "BILL_PAYMENT": ("Bill Payment", "Bill Payment"),
    "AIRTIME_TOPUP": ("Airtime Top Up", "Airtime Top Up"),
    "CUSTOMER_REGISTRATION": ("Customer Registration", None),
    "MERCHANT_REGISTRATION": ("Merchant Registration", None),
    # ---- sheet-only products
    "DOMESTIC_REMITTANCE": ("Domestic Remittance / P2P", None),
    "INTERNATIONAL_REMITTANCE": ("International Remittances", None),
    "BANK_ACCOUNT_OPENING": ("Bank Account Opening", None),
    "MICRO_SAVINGS": ("Micro-Savings", None),
    "G2P_P2G": ("Government-to-Person / Person-Government Payments", None),
    "HUMANITARIAN_TRANSFER": ("Humanitarian Cash Transfer Programs", None),
    "EDUCATIONAL_GRANTS": ("Educational Grants and Student Stipends", None),
    "AGRI_VOUCHER": ("Agricultural Input Voucher Disbursement", None),
    "MICRO_NANO_LOANS": ("Micro and Nano Loans", None),
    "PAYG_FINANCING": ("Pay-As-You-Go (PAYG) Asset Financing", None),
    "GROUP_LENDING": ("Digital Group / Cooperative Lending", None),
    "MICROINSURANCE": ("Microinsurance / Insurance Premium Collection", None),
    "INSURANCE_CLAIMS": ("Insurance Claims Disbursement", None),
    "MSME_LENDING": ("MSME Working Capital Lending", None),
    "SCHOOL_FEE": ("Digital School Fee Collection", None),
    "HEALTH_INSURANCE": ("GVT Health Insurance & Co-Payment Collection", None),
    "DONATIONS": ("Digital Donations / Crowdfunding", None),
    "CIVIL_CERTIFICATE_FEES": ("Birth, Marriage and Death Certificate Fee Collection", None),
    "SIM_DISTRIBUTION": ("Sim Card Distribution-Sales", None),
}

# (service name, percent, ServiceType codes it applies to). Each code may appear only once.
RATES: list[tuple[str, int, list[str]]] = [
    ("Cash-In / Cash-Out Services", 50, ["CASH_IN", "CASH_OUT"]),
    ("Domestic Remittance Services/P2P", 40, ["DOMESTIC_REMITTANCE"]),
    ("International Remittances", 40, ["INTERNATIONAL_REMITTANCE"]),
    ("Digital Wallet Opening", 50, ["CUSTOMER_REGISTRATION"]),
    ("Bank Account Opening", 50, ["BANK_ACCOUNT_OPENING"]),
    ("Micro-Savings", 50, ["MICRO_SAVINGS"]),
    ("Utility Bill Payment Services", 50, ["BILL_PAYMENT"]),
    ("Government-to-Person/Person-Government (G2P/P2G) Payments", 50, ["G2P_P2G"]),
    ("Humanitarian Cash Transfer Programs (NGO Funded)", 50, ["HUMANITARIAN_TRANSFER"]),
    ("Educational Grants and Student Stipends", 40, ["EDUCATIONAL_GRANTS"]),
    ("Agricultural Input Voucher Disbursement", 50, ["AGRI_VOUCHER"]),
    ("Micro and Nano Loans", 40, ["MICRO_NANO_LOANS"]),
    ("Pay-As-You-Go (PAYG) Asset Financing", 30, ["PAYG_FINANCING"]),
    ("Digital Group Lending / Cooperative Lending", 50, ["GROUP_LENDING"]),
    ("Microinsurance/Insurance Premium Collection", 40, ["MICROINSURANCE"]),
    ("Insurance Claims Disbursement", 40, ["INSURANCE_CLAIMS"]),
    ("Merchant Payment Acceptance-Onboarding", 40, ["MERCHANT_REGISTRATION"]),
    ("MSME Working Capital Lending", 40, ["MSME_LENDING"]),
    ("Digital School Fee Collection", 30, ["SCHOOL_FEE"]),
    ("GVT Health Insurance & Co-Payment Collection", 50, ["HEALTH_INSURANCE"]),
    ("Digital Donations / Crowdfunding", 50, ["DONATIONS"]),
    ("Birth, Marriage, and Death Certificate Fee Collection", 50, ["CIVIL_CERTIFICATE_FEES"]),
    ("Airtime Top-Up (Including EVD)", 50, ["AIRTIME_TOPUP"]),
    ("Sim Card Distribution-Sales", 40, ["SIM_DISTRIBUTION"]),
]

# code -> (sort_order, description). Other codes keep the default (100).
CATALOGUE_ORDER: dict[str, tuple[int, str | None]] = {
    "CASH_IN": (1, None),
    "CASH_OUT": (2, None),
    "CUSTOMER_REGISTRATION": (3, "Digital wallet account opening and management"),
    "BILL_PAYMENT": (4, "Utility bill payment services: school, electricity, water, DSTV, etc."),
    "LIBAM_INSURANCE": (
        5,
        "Libam Life Insurance: Individual Life, Libam Care (Hospitalization), and School Fee Insurance",
    ),
    "CUSTOMER_UPGRADE": (6, None),
    "AIRTIME_TOPUP": (7, "Airtime top-up (including EVD)"),
    "SIM_DISTRIBUTION": (8, None),
}

# only the two new products; add them to SERVICE_TYPES
SERVICE_TYPES["LIBAM_INSURANCE"] = ("Libam Life Insurance", None)
SERVICE_TYPES["CUSTOMER_UPGRADE"] = ("Customer Upgrade", None)


def _apply_catalogue_order(db) -> None:
    """Create missing ordered types and stamp sort_order / description. Never overwrites edits."""
    for code, (order, desc) in CATALOGUE_ORDER.items():
        st = _get_service_type(db, code)
        if st.sort_order == 100:          # still the default, so not set by hand
            st.sort_order = order
        if desc and not st.description:
            st.description = desc
    db.flush()
def _get_service_type(db, code: str) -> ServiceType:
    name, label = SERVICE_TYPES[code]
    obj = db.scalars(select(ServiceType).where(ServiceType.code == code, ServiceType.deleted_at.is_(None))).first()
    if obj is None and label:  # reuse a type created by hand with the same CSV label
        obj = db.scalars(
            select(ServiceType).where(ServiceType.csv_label == label, ServiceType.deleted_at.is_(None))
        ).first()
    if obj is None:
        obj = ServiceType(code=code, name=name, csv_label=label, status=Status.ACTIVE)
        db.add(obj)
        db.flush()
        print(f"  created service type {code}")
    return obj


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true", help="stamp existing rows that have no commission yet")
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
            _apply_catalogue_order(db)
        existing = {
            n.lower()
            for n in db.scalars(
                select(func.lower(CommissionRate.service_name)).where(CommissionRate.deleted_at.is_(None))
            )
        }

        # service types already used by an active rate (a type can be in only one rate)
        taken: dict = {
            sid: rname
            for sid, rname in db.execute(
                select(link.c.service_type_id, CommissionRate.service_name)
                .join(CommissionRate, CommissionRate.id == link.c.commission_rate_id)
                .where(CommissionRate.deleted_at.is_(None))
            )
        }

        created = skipped = 0
        for name, rate, codes in RATES:
            if name.lower() in existing:
                skipped += 1
                continue

            types: list[ServiceType] = []
            for code in codes:
                st = _get_service_type(db, code)
                if st.id in taken:
                    print(f"  warning: '{st.name}' is already in rate '{taken[st.id]}', not linked to '{name}'")
                    continue
                types.append(st)

            if not types:
                print(f"  skipped '{name}': none of its service types are free")
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
            for st in types:
                taken[st.id] = name
            created += 1
        print(f"Commission rates: {created} created, {skipped} skipped.")

        if args.backfill:
            result = backfill_commission(db)
            processed = sum(v["processed"] for v in result.values())
            calculated = sum(v["calculated"] for v in result.values())
            print(f"Backfill: {processed:,} rows processed, {calculated:,} calculated.")


if __name__ == "__main__":
    main()