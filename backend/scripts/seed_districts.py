"""Seed the main Ethio Post districts.

Usage:  python -m scripts.seed_districts

Safe to re-run: existing districts are matched by name and skipped.
The list comes from app/core/region_alignment.py.
"""
import logging

from sqlalchemy import select

from app.core.logging_config import setup_logging
from app.core.region_alignment import DISTRICTS
from app.db.session import SessionLocal
from app.models import District

logger = logging.getLogger(__name__)


def get_or_create(db, name: str, description: str) -> bool:
    """Return True if a new district was created."""
    existing = db.scalars(
        select(District).where(District.name == name, District.deleted_at.is_(None))
    ).first()
    if existing:
        logger.debug("district exists, skipped: %s", name)
        return False
    db.add(District(name=name, description=description, parent_id=None))
    logger.info("district created: %s", name)
    return True


def main() -> None:
    setup_logging()
    created = 0
    with SessionLocal() as db:
        for name, hq in DISTRICTS:
            created += get_or_create(db, name, f"Ethio Post district (HQ: {hq})")
        db.commit()
    logger.info("seed done: %d created, %d already existed", created, len(DISTRICTS) - created)
    print(f"Done. Created {created} districts.")


if __name__ == "__main__":
    main()
