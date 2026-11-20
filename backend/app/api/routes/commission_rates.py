import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import func

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status
from app.crud import commission_rate_crud
from app.models import CommissionRate
from app.schemas.commission_rate import CommissionRateCreate, CommissionRateRead, CommissionRateUpdate
from sqlalchemy import select
from app.models import ServiceType
from app.models.commission_rate import commission_rate_service_types as link
router = APIRouter(prefix="/commission-rates", tags=["commission-rates"])


def _resolve_service_types(db, ids: list[uuid.UUID]) -> list[ServiceType]:
    ids = list(dict.fromkeys(ids))  # de-dupe, keep order
    found = list(db.scalars(select(ServiceType).where(ServiceType.id.in_(ids), ServiceType.deleted_at.is_(None))))
    if len(found) != len(ids):
        raise conflict("One or more selected service types do not exist")
    return found


def _ensure_types_free(db, types: list[ServiceType], exclude_id: uuid.UUID | None = None) -> None:
    q = (
        select(ServiceType.name, CommissionRate.service_name)
        .join(link, link.c.service_type_id == ServiceType.id)
        .join(CommissionRate, CommissionRate.id == link.c.commission_rate_id)
        .where(ServiceType.id.in_([t.id for t in types]), CommissionRate.deleted_at.is_(None))
    )
    if exclude_id:
        q = q.where(CommissionRate.id != exclude_id)
    clashes = db.execute(q).all()
    if clashes:
        detail = "; ".join(f"“{t}” is already in “{r}”" for t, r in clashes)
        raise conflict(f"A service type can belong to only one commission rate: {detail}")


def _ensure_unique_name(db, name: str, exclude_id: uuid.UUID | None = None) -> None:
    conditions = [func.lower(CommissionRate.service_name) == name.strip().lower()]
    if exclude_id:
        conditions.append(CommissionRate.id != exclude_id)
    if commission_rate_crud.count(db, *conditions):
        raise conflict(f"A commission rate for “{name}” already exists")


@router.get("", response_model=list[CommissionRateRead])
def list_commission_rates(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by service name"),
) -> list[CommissionRate]:
    conditions = []
    if status_:
        conditions.append(CommissionRate.status == status_)
    if q:
        conditions.append(CommissionRate.service_name.ilike(f"%{q}%"))
    return commission_rate_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{rate_id}", response_model=CommissionRateRead)
def get_commission_rate(rate_id: uuid.UUID, db: DbSession, _: CurrentUser) -> CommissionRate:
    return get_or_404(commission_rate_crud, db, rate_id, "Commission rate")


@router.post("", response_model=CommissionRateRead, status_code=status.HTTP_201_CREATED)
def create_commission_rate(payload: CommissionRateCreate, db: DbSession, admin: AdminUser) -> CommissionRate:
    _ensure_unique_name(db, payload.service_name)
    types = _resolve_service_types(db, payload.service_type_ids)
    _ensure_types_free(db, types)
    data = payload.model_dump(exclude={"service_type_ids"})
    data["service_name"] = " ".join(data["service_name"].split())
    data["service_types"] = types
    return commission_rate_crud.create(db, data, actor_id=admin.id)


@router.patch("/{rate_id}", response_model=CommissionRateRead)
def update_commission_rate(
    rate_id: uuid.UUID, payload: CommissionRateUpdate, db: DbSession, admin: AdminUser
) -> CommissionRate:
    rate = get_or_404(commission_rate_crud, db, rate_id, "Commission rate")
    data = payload.model_dump(exclude_unset=True, exclude={"service_type_ids"})
    if data.get("service_name"):
        data["service_name"] = " ".join(data["service_name"].split())
        _ensure_unique_name(db, data["service_name"], exclude_id=rate.id)
    if payload.service_type_ids is not None:
        types = _resolve_service_types(db, payload.service_type_ids)
        _ensure_types_free(db, types, exclude_id=rate.id)
        data["service_types"] = types
    return commission_rate_crud.update(db, rate, data, actor_id=admin.id)


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commission_rate(rate_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    """Safe: transactions keep their own rate snapshot."""
    rate = get_or_404(commission_rate_crud, db, rate_id, "Commission rate")
    commission_rate_crud.soft_delete(db, rate, actor_id=admin.id)