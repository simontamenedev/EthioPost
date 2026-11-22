"""Seed service-type targets and their monthly periods (Nov-26 to Jun-27).

Usage:
    python -m scripts.seed_service_targets

Service types that don't exist yet are created automatically
(`seed_commission_rules` can still be run first to set up their rates).

Creates ONE target per service group covering Nov 1, 2026 to Jun 30, 2027,
with one period per month. The target value is the sum of its periods.
"Libam Life Insurance" is one target shared by three Libam service types
(Individual, School Fee Guarantee and Care).

Safe to re-run: a service type already assigned to an overlapping target
within this date range is skipped.
"""

import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.core.audit_context import request_ctx
from app.core.enums import UserRole
from app.crud import (
    service_type_target_crud,
    service_type_target_period_crud,
)
from app.crud.base import CRUDBase
from app.db.session import SessionLocal
from app.models import ServiceType, ServiceTypeTargetItem, User
from app.services.service_target_service import overlapping_service_type_names


# Nov-26 ... Jun-27
MONTHS: list[tuple[int, int]] = [
    (2026, 11),
    (2026, 12),
    (2027, 1),
    (2027, 2),
    (2027, 3),
    (2027, 4),
    (2027, 5),
    (2027, 6),
]

START = date(MONTHS[0][0], MONTHS[0][1], 1)

END = date(
    MONTHS[-1][0],
    MONTHS[-1][1],
    calendar.monthrange(*MONTHS[-1])[1],
)


_WALLET_SIM = [
    17460,
    209525,
    261906,
    349208,
    349208,
    349208,
    122223,
    87302,
]


# (target name, service type codes, monthly target amounts)
DATA: list[tuple[str, list[str], list[int]]] = [
    ("Cash-In / Cash-Out Services", ["CASH_IN", "CASH_OUT"], _WALLET_SIM),
    ("Digital Wallet Account Opening and Management", ["CUSTOMER_REGISTRATION"], _WALLET_SIM),
    ("Utility Bill Payment Services", ["BILL_PAYMENT"], [437, 5238, 6548, 8730, 8730, 8730, 3056, 2183]),
    (
        "Libam Life Insurance",
        ["LIBAM_INDIVIDUAL", "LIBAM_SCHOOL_FEE_GUARANTEE", "LIBAM_CARE"],
        [3929, 47143, 58929, 78572, 78572, 78572, 27500, 19643],
    ),
    ("Customer Upgrade", ["CUSTOMER_UPGRADE"], [8730, 104763, 130953, 174604, 174604, 174604, 61111, 43651]),
    ("Airtime Top-Up (Including EVD)", ["AIRTIME_TOPUP"], [21826, 261906, 327383, 436511, 436511, 436511, 152779, 109128]),
    ("Sim Card Distribution", ["SIM_DISTRIBUTION"], _WALLET_SIM),
]

# code -> (name, csv_label). csv_label is None for services that are not
# reported as transactions. Only used when a service type has to be created.
SERVICE_TYPE_DEFAULTS: dict[str, tuple[str, str | None]] = {
    "CASH_IN": ("Cash In", "Cash In"),
    "CASH_OUT": ("Cash Out", "Cash Out"),
    "CUSTOMER_REGISTRATION": ("Customer Registration", None),
    "BILL_PAYMENT": ("Bill Payment", "Bill Payment"),
    "LIBAM_INDIVIDUAL": ("Libam Individual", None),
    "LIBAM_SCHOOL_FEE_GUARANTEE": ("Libam Life Insurance School Fee Guarantee", None),
    "LIBAM_CARE": ("Libam Care (Hospitalization)", None),
    "CUSTOMER_UPGRADE": ("Customer Upgrade", None),
    "AIRTIME_TOPUP": ("Airtime Top Up", "Airtime Top Up"),
    "SIM_DISTRIBUTION": ("SIM Distribution", None),
}


item_crud = CRUDBase(ServiceTypeTargetItem)
service_type_crud = CRUDBase(ServiceType)


def get_or_create_service_type(db, code: str, actor_id) -> ServiceType:
    """Return the active service type with this code, creating it when missing."""
    service_type = db.scalars(
        select(ServiceType).where(
            ServiceType.code == code,
            ServiceType.deleted_at.is_(None),
        )
    ).first()

    if service_type is not None:
        return service_type

    name, csv_label = SERVICE_TYPE_DEFAULTS.get(code, (code.replace("_", " ").title(), None))
    service_type = service_type_crud.create(
        db,
        {"code": code, "name": name, "csv_label": csv_label},
        actor_id=actor_id,
    )
    print(f"  Created service type: {code} ({name})")
    return service_type


def main() -> None:
    request_ctx.set({
        "ip_address": None,
        "user_agent": "seed_service_targets",
    })

    with SessionLocal() as db:
        admin = db.scalars(
            select(User)
            .where(
                User.role == UserRole.ADMIN,
                User.deleted_at.is_(None),
            )
            .order_by(User.created_at)
        ).first()

        if admin is None:
            raise SystemExit(
                "No admin user found. Run `python -m scripts.create_admin` first."
            )

        created = 0
        skipped = 0

        for name, codes, amounts in DATA:

            # Validate monthly amounts first, before creating anything.
            if len(amounts) != len(MONTHS):
                raise ValueError(
                    f"{name}: expected {len(MONTHS)} monthly amounts, "
                    f"got {len(amounts)}."
                )

            # Make sure each service type exists (create it if not).
            types = [get_or_create_service_type(db, code, admin.id) for code in codes]

            total = sum(Decimal(amount) for amount in amounts)

            print(f"\n{name}: total {total:,}")

            # Skip service types already assigned to overlapping targets.
            taken = overlapping_service_type_names(
                db,
                [service_type.id for service_type in types],
                START,
                END,
            )

            if taken:
                print(
                    "  Skipped: already assigned to an overlapping target: "
                    + ", ".join(taken)
                )
                skipped += 1
                continue

            # Create the main target.
            target = service_type_target_crud.create(
                db,
                {
                    "name": f"{name} {START:%b-%y} to {END:%b-%y}",
                    "start_date": START,
                    "end_date": END,
                    "target_value": total,
                },
                actor_id=admin.id,
            )

            # Assign service types to the target.
            for service_type in types:
                item_crud.create(
                    db,
                    {
                        "service_type_target_id": target.id,
                        "service_type_id": service_type.id,
                    },
                    actor_id=admin.id,
                )

            # Create one target period per month.
            for (year, month), amount in zip(MONTHS, amounts):
                period_start = date(year, month, 1)
                period_end = date(
                    year,
                    month,
                    calendar.monthrange(year, month)[1],
                )

                service_type_target_period_crud.create(
                    db,
                    {
                        "service_type_target_id": target.id,
                        "start_date": period_start,
                        "end_date": period_end,
                        "target_value": Decimal(amount),
                    },
                    actor_id=admin.id,
                )

            print(
                f"  Created target: {total:,} "
                f"({START} to {END}) "
                f"with {len(MONTHS)} monthly periods."
            )

            created += 1

        print(
            f"\nService targets: {created} created, "
            f"{skipped} skipped."
        )


if __name__ == "__main__":
    main()