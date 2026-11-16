# add to app/services/service_target_service.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.service_target import ServiceTypeTarget, ServiceTypeTargetItem


class TargetServiceTypeError(ValueError):
    pass


def set_service_types(
    session: Session,
    target: ServiceTypeTarget,
    service_type_ids: set[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> None:
    """Make the target cover exactly `service_type_ids` (others are soft-deleted)."""
    if not service_type_ids:
        raise TargetServiceTypeError("A target needs at least one service type.")

    # A service type can only be in one active target per year.
    conflicts = session.scalars(
        select(ServiceTypeTargetItem.service_type_id).where(
            ServiceTypeTargetItem.service_type_id.in_(service_type_ids),
            ServiceTypeTargetItem.year == target.year,
            ServiceTypeTargetItem.service_type_target_id != target.id,
            ServiceTypeTargetItem.deleted_at.is_(None),
        )
    ).all()
    if conflicts:
        raise TargetServiceTypeError(
            f"Service types already in another {target.year} target: {sorted(map(str, conflicts))}"
        )

    existing = {
        i.service_type_id: i
        for i in session.scalars(
            select(ServiceTypeTargetItem).where(
                ServiceTypeTargetItem.service_type_target_id == target.id,
                ServiceTypeTargetItem.deleted_at.is_(None),
            )
        )
    }
    now = datetime.now(timezone.utc)

    for service_type_id in service_type_ids - existing.keys():
        session.add(
            ServiceTypeTargetItem(
                service_type_target_id=target.id,
                year=target.year,
                service_type_id=service_type_id,
                created_by=actor_id,
            )
        )
    for service_type_id in existing.keys() - service_type_ids:
        item = existing[service_type_id]
        item.deleted_at = now
        item.deleted_by = actor_id

    session.flush()
    session.expire(target, ["items"])