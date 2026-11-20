
"""Seed service-type targets and their monthly periods (Nov-26 to Jun-27).

Usage:
    python -m scripts.seed_service_targets

Run `python -m scripts.seed_commission_rates` first, so the service types exist.

Creates ONE target per service covering Nov 1, 2026 to Jun 30, 2027,
with one period per month. The target value is the sum of its periods.

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
    ("Libam Life Insurance", ["LIBAM_INSURANCE"], [3929, 47143, 58929, 78572, 78572, 78572, 27500, 19643]),
    ("Customer Upgrade", ["CUSTOMER_UPGRADE"], [8730, 104763, 130953, 174604, 174604, 174604, 61111, 43651]),
    ("Airtime Top-Up (Including EVD)", ["AIRTIME_TOPUP"], [21826, 261906, 327383, 436511, 436511, 436511, 152779, 109128]),
    ("Sim Card Distribution", ["SIM_DISTRIBUTION"], _WALLET_SIM),
]


item_crud = CRUDBase(ServiceTypeTargetItem)


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

            # Ensure each service type exists.
            types = []

            for code in codes:
                service_type = db.scalars(
                    select(ServiceType).where(
                        ServiceType.code == code,
                        ServiceType.deleted_at.is_(None),
                    )
                ).first()

                if service_type is None:
                    raise SystemExit(
                        f"Service type {code} not found. "
                        "Run seed_commission_rates first."
                    )

                types.append(service_type)

            # Validate monthly amounts.
            if len(amounts) != len(MONTHS):
                raise ValueError(
                    f"{name}: expected {len(MONTHS)} monthly amounts, "
                    f"got {len(amounts)}."
                )

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
