"""Helpers for the two-level district hierarchy (parent -> children)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import District


def child_ids(db: Session, district_id: uuid.UUID) -> list[uuid.UUID]:
    """Ids of the active children of a district (empty for a child or a leaf parent)."""
    return list(
        db.scalars(
            select(District.id).where(
                District.parent_id == district_id, District.deleted_at.is_(None)
            )
        )
    )


def scope_ids(db: Session, district_id: uuid.UUID) -> list[uuid.UUID]:
    """The district itself plus its children. Use this for roll-ups: filtering or summing
    by a parent district must include everything under its children."""
    return [district_id, *child_ids(db, district_id)]


def root_map(db: Session) -> dict[uuid.UUID, uuid.UUID]:
    """child_id -> parent_id for every active child district.

    Top-level districts are not in the map, so `mapping.get(id, id)` (see `to_root`)
    returns the parent for a child and the district itself for a parent.
    Imported rows and agents point at CHILD districts (the ET regions), so any report
    that is shown per parent has to fold the child ids through this map.
    """
    rows = db.execute(
        select(District.id, District.parent_id).where(
            District.parent_id.is_not(None), District.deleted_at.is_(None)
        )
    )
    return {child_id: parent_id for child_id, parent_id in rows}


def to_root(mapping: dict[uuid.UUID, uuid.UUID], district_id: uuid.UUID) -> uuid.UUID:
    return mapping.get(district_id, district_id)