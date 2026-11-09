# app/api/routes/service_types.py
import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import func

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status, UserRole
from app.crud import commission_rule_crud, service_type_crud
from app.models import CommissionRule, ServiceType
from app.schemas.service_type import ServiceTypeCreate, ServiceTypeDetail, ServiceTypeRead, ServiceTypeUpdate
from app.services.audit_stamp import audit_stamp

router = APIRouter(prefix="/service-types", tags=["service-types"])


def _norm(v: str) -> str:
    return " ".join(v.split())


def _ensure_unique(db, data: dict, exclude_id: uuid.UUID | None = None) -> None:
    # csv_label must be unique: it is how imported transactions find their service type.
    for column, key in ((ServiceType.code, "code"), (ServiceType.name, "name"), (ServiceType.csv_label, "csv_label")):
        value = data.get(key)
        if not value:
            continue
        conditions = [func.lower(column) == value.lower()]
        if exclude_id:
            conditions.append(ServiceType.id != exclude_id)
        if service_type_crud.count(db, *conditions):
            raise conflict(f"A service type with {key.replace('_', ' ')} “{value}” already exists")


def _clean(data: dict) -> dict:
    if data.get("code"):
        data["code"] = _norm(data["code"]).upper().replace(" ", "_")
    if data.get("name"):
        data["name"] = _norm(data["name"])
    if "csv_label" in data:
        data["csv_label"] = _norm(data["csv_label"]) if data["csv_label"] else None
    return data


@router.get("", response_model=list[ServiceTypeRead])
def list_service_types(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by code, name or CSV label"),
) -> list[ServiceType]:
    conditions = []
    if status_:
        conditions.append(ServiceType.status == status_)
    if q:
        like = f"%{q}%"
        conditions.append(ServiceType.name.ilike(like) | ServiceType.code.ilike(like) | ServiceType.csv_label.ilike(like))
    return service_type_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{service_type_id}", response_model=ServiceTypeDetail)
def get_service_type(service_type_id: uuid.UUID, db: DbSession, user: CurrentUser) -> ServiceTypeDetail:
    obj = get_or_404(service_type_crud, db, service_type_id, "Service type")
    return ServiceTypeDetail.model_validate(obj).model_copy(update={
        "rule_count": commission_rule_crud.count(db, CommissionRule.service_type_id == obj.id),
        "audit": audit_stamp(db, obj) if user.role == UserRole.ADMIN else None,
    })


@router.post("", response_model=ServiceTypeRead, status_code=status.HTTP_201_CREATED)
def create_service_type(payload: ServiceTypeCreate, db: DbSession, admin: AdminUser) -> ServiceType:
    data = _clean(payload.model_dump())
    _ensure_unique(db, data)
    return service_type_crud.create(db, data, actor_id=admin.id)


@router.patch("/{service_type_id}", response_model=ServiceTypeRead)
def update_service_type(
    service_type_id: uuid.UUID, payload: ServiceTypeUpdate, db: DbSession, admin: AdminUser
) -> ServiceType:
    obj = get_or_404(service_type_crud, db, service_type_id, "Service type")
    data = _clean(payload.model_dump(exclude_unset=True))
    _ensure_unique(db, data, exclude_id=obj.id)
    return service_type_crud.update(db, obj, data, actor_id=admin.id)


@router.delete("/{service_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_type(service_type_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    obj = get_or_404(service_type_crud, db, service_type_id, "Service type")
    if commission_rule_crud.count(db, CommissionRule.service_type_id == obj.id):
        raise conflict("This service type is used by commission rules. Delete them first.")
    service_type_crud.soft_delete(db, obj, actor_id=admin.id)