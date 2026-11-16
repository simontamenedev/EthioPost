# app/api/routes/service_type_targets.py
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import AuditAction, Status, UserRole
from app.crud import service_type_target_crud
from app.crud.audit import record_audit
from app.models import District, DistrictTarget,DistrictTargetMonth, ServiceType, ServiceTypeTarget, ServiceTypeTargetItem
from app.schemas.service_type_target import (
    DistrictAllocationPayload,
    DistrictAllocationRow,
    MonthAllocationPayload,
    MonthAllocationResponse,
    MonthTargetRead,
    TargetCreate,
    TargetDetail,
    TargetRead,
    TargetUpdate,
    TargetPerformance,
)
from app.services.audit_stamp import audit_stamp
from app.services.service_target_service import (
    TargetAllocationError,
    TargetServiceTypeError,
    allocate_by_percent,
    target_performance,
    replace_district_targets,
    replace_monthly_percents,
    set_service_types,
    split_evenly,
    split_months_evenly,
    update_national_target,
)

router = APIRouter(prefix="/service-type-targets", tags=["service-type-targets"])
LABEL = "Annual target"

# Avoids N+1 queries when listing: service types and district shares load in bulk.
_LIST_OPTIONS = (
    selectinload(ServiceTypeTarget.items).selectinload(ServiceTypeTargetItem.service_type),
    selectinload(ServiceTypeTarget.district_targets),
)

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _months_diff(old: dict[str, str], new: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    """Only the months whose percentage changed, labelled by month name."""
    old_out: dict[str, str] = {}
    new_out: dict[str, str] = {}
    for m in range(1, 13):
        before = Decimal(old.get(str(m), "0.00"))
        after = Decimal(new.get(str(m), "0.00"))
        if before != after:
            old_out[MONTH_NAMES[m - 1]] = f"{before:.2f}%"
            new_out[MONTH_NAMES[m - 1]] = f"{after:.2f}%"
    return old_out, new_out
def _unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, message)


def _ensure_exist(db, model, ids: set[uuid.UUID], label: str) -> None:
    found = set(db.scalars(select(model.id).where(model.id.in_(ids), model.deleted_at.is_(None))))
    if found != ids:
        raise _unprocessable(f"Unknown {label}: {sorted(map(str, ids - found))}")


def _ensure_no_overlap(db, year: int, ids: set[uuid.UUID], exclude_id: uuid.UUID | None = None) -> None:
    """A service type may be in only one active target per year."""
    stmt = select(ServiceType.name).join(
        ServiceTypeTargetItem, ServiceTypeTargetItem.service_type_id == ServiceType.id
    ).where(
        ServiceTypeTargetItem.service_type_id.in_(ids),
        ServiceTypeTargetItem.year == year,
        ServiceTypeTargetItem.deleted_at.is_(None),
    )
    if exclude_id:
        stmt = stmt.where(ServiceTypeTargetItem.service_type_target_id != exclude_id)
    names = list(db.scalars(stmt))
    if names:
        raise conflict(f"Already in another {year} target: {', '.join(sorted(names))}")


def _detail(db, target: ServiceTypeTarget, user) -> TargetDetail:
    return TargetDetail.model_validate(target).model_copy(
        update={"audit": audit_stamp(db, target) if user.role == UserRole.ADMIN else None}
    )


def _split_snapshot(target: ServiceTypeTarget) -> dict[str, str]:
    return {str(dt.district_id): str(dt.target_value) for dt in target.district_targets}


def _type_ids_snapshot(target: ServiceTypeTarget) -> list[str]:
    return sorted(str(i.service_type_id) for i in target.items)


@router.get("", response_model=list[TargetRead])
def list_targets(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    year: int | None = Query(None),
    service_type_id: uuid.UUID | None = Query(None),
    q: str | None = Query(None, description="Search by name"),
) -> list[ServiceTypeTarget]:
    conditions = []
    if status_:
        conditions.append(ServiceTypeTarget.status == status_)
    if year:
        conditions.append(ServiceTypeTarget.year == year)
    if q:
        conditions.append(ServiceTypeTarget.name.ilike(f"%{q}%"))
    if service_type_id:
        conditions.append(
            ServiceTypeTarget.id.in_(
                select(ServiceTypeTargetItem.service_type_target_id).where(
                    ServiceTypeTargetItem.service_type_id == service_type_id,
                    ServiceTypeTargetItem.deleted_at.is_(None),
                )
            )
        )
    return service_type_target_crud.get_multi(db, *conditions, skip=skip, limit=limit, options=_LIST_OPTIONS)


@router.get("/{target_id}", response_model=TargetDetail)
def get_target(target_id: uuid.UUID, db: DbSession, user: CurrentUser) -> TargetDetail:
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    return _detail(db, target, user)


@router.post("", response_model=TargetDetail, status_code=status.HTTP_201_CREATED)
def create_target(payload: TargetCreate, db: DbSession, admin: AdminUser) -> TargetDetail:
    service_type_ids = set(payload.service_type_ids)
    _ensure_exist(db, ServiceType, service_type_ids, "service types")
    _ensure_no_overlap(db, payload.year, service_type_ids)

    data = payload.model_dump(exclude={"service_type_ids"})
    if data.get("name"):
        data["name"] = " ".join(data["name"].split())
    target = service_type_target_crud.create(db, data, actor_id=admin.id)  # commits
    try:
        set_service_types(db, target, service_type_ids, actor_id=admin.id)
    except TargetServiceTypeError as exc:  # lost a race with another request
        service_type_target_crud.soft_delete(db, target, actor_id=admin.id)
        raise conflict(str(exc))
    db.commit()
    db.refresh(target)
    return _detail(db, target, admin)


@router.patch("/{target_id}", response_model=TargetDetail)
def update_target(target_id: uuid.UUID, payload: TargetUpdate, db: DbSession, admin: AdminUser) -> TargetDetail:
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    data = payload.model_dump(exclude_unset=True)
    service_type_ids = data.pop("service_type_ids", None)
    keep_percentages = data.pop("keep_percentages", True)
    new_value = data.pop("target_value", None)
    if data.get("name"):
        data["name"] = " ".join(data["name"].split())

    old_audit: dict = {}
    new_audit: dict = {}
    try:
        if new_value is not None and new_value != target.target_value:
            old_audit["target_value"], new_audit["target_value"] = str(target.target_value), str(new_value)
            old_audit["district_targets"] = _split_snapshot(target)
            update_national_target(db, target, new_value, keep_percentages=keep_percentages, actor_id=admin.id)
            new_audit["district_targets"] = _split_snapshot(target)
        if service_type_ids is not None:
            ids = set(service_type_ids)
            _ensure_exist(db, ServiceType, ids, "service types")
            _ensure_no_overlap(db, target.year, ids, exclude_id=target.id)
            old_audit["service_type_ids"] = _type_ids_snapshot(target)
            set_service_types(db, target, ids, actor_id=admin.id)
            new_audit["service_type_ids"] = _type_ids_snapshot(target)
    except TargetAllocationError as exc:
        db.rollback()
        raise _unprocessable(str(exc))
    except TargetServiceTypeError as exc:
        db.rollback()
        raise conflict(str(exc))

    # Value / service-type / split changes are not plain columns, so audit them explicitly.
    if new_audit:
        record_audit(
            db,
            action=AuditAction.UPDATE,
            obj=target,
            actor_id=admin.id,
            old_values=old_audit,
            new_values=new_audit,
        )

    if data:
        service_type_target_crud.update(db, target, data, actor_id=admin.id)  # commits everything pending
    else:
        db.commit()
    db.refresh(target)
    return _detail(db, target, admin)


@router.get("/{target_id}/districts", response_model=list[DistrictAllocationRow])
def list_district_allocations(target_id: uuid.UUID, db: DbSession, _: CurrentUser) -> list[DistrictAllocationRow]:
    """Every active district with its current share (0 when it has none).

    Districts that are no longer active but still hold a share are included, so
    saving the split never drops them silently.
    """
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    shares = {dt.district_id: dt for dt in target.district_targets}
    stmt = (
        select(District)
        .where(
            District.deleted_at.is_(None),
            or_(District.status == Status.ACTIVE, District.id.in_(list(shares))),
        )
        .order_by(District.name)
    )
    rows = []
    for district in db.scalars(stmt):
        share = shares.get(district.id)
        rows.append(
            DistrictAllocationRow(
                district_id=district.id,
                district_name=district.name,
                target_value=share.target_value if share else Decimal("0"),
                target_percent=share.target_percent if share else Decimal("0.00"),
            )
        )
    return rows


@router.put("/{target_id}/districts", response_model=TargetDetail)
def set_district_targets(
    target_id: uuid.UUID, payload: DistrictAllocationPayload, db: DbSession, admin: AdminUser
) -> TargetDetail:
    """Replace the district split. Districts not listed are removed from the split."""
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    district_ids = [a.district_id for a in payload.allocations]
    _ensure_exist(db, District, set(district_ids), "districts")

    old_split = _split_snapshot(target)
    try:
        if payload.mode == "even":
            split_evenly(db, target, district_ids, actor_id=admin.id)
        elif payload.mode == "percent":
            allocate_by_percent(db, target, {a.district_id: a.amount for a in payload.allocations}, actor_id=admin.id)
        else:
            replace_district_targets(
                db, target, {a.district_id: a.amount for a in payload.allocations}, actor_id=admin.id
            )
    except TargetAllocationError as exc:
        db.rollback()
        raise _unprocessable(str(exc))

    new_split = _split_snapshot(target)
    if new_split != old_split:
        record_audit(
            db,
            action=AuditAction.UPDATE,
            obj=target,
            actor_id=admin.id,
            old_values={"district_targets": old_split},
            new_values={"district_targets": new_split},
        )
    db.commit()
    db.refresh(target)
    return _detail(db, target, admin)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(target_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    now = datetime.now(UTC)
        # inside delete_target, before the existing loop
    district_target_ids = list(
        db.scalars(
            select(DistrictTarget.id).where(
                DistrictTarget.service_type_target_id == target.id, DistrictTarget.deleted_at.is_(None)
            )
        )
    )
    if district_target_ids:
        for row in db.scalars(
            select(DistrictTargetMonth).where(
                DistrictTargetMonth.district_target_id.in_(district_target_ids),
                DistrictTargetMonth.deleted_at.is_(None),
            )
        ):
            row.deleted_at, row.deleted_by = now, admin.id
    for model in (DistrictTarget, ServiceTypeTargetItem):
        rows = db.scalars(
            select(model).where(model.service_type_target_id == target.id, model.deleted_at.is_(None))
        )
        for row in rows:
            row.deleted_at, row.deleted_by = now, admin.id
    service_type_target_crud.soft_delete(db, target, actor_id=admin.id)  # commits everything

def _months_snapshot(dt: DistrictTarget) -> dict[str, str]:
    return {str(m.month): str(m.percent) for m in dt.months}


def _district_target(target: ServiceTypeTarget, district_id: uuid.UUID) -> DistrictTarget:
    for dt in target.district_targets:
        if dt.district_id == district_id:
            return dt
    raise HTTPException(status.HTTP_404_NOT_FOUND, "This district has no share in the target yet.")


def _month_response(dt: DistrictTarget) -> MonthAllocationResponse:
    by_month = {m["month"]: m for m in dt.monthly_targets}
    zero = Decimal("0.00")
    return MonthAllocationResponse(
        district_id=dt.district_id,
        district_name=dt.district.name,
        target_value=dt.target_value,
        months=[
            MonthTargetRead(
                month=m,
                percent=by_month[m]["percent"] if m in by_month else zero,
                target_value=by_month[m]["target_value"] if m in by_month else zero,
            )
            for m in range(1, 13)
        ],
    )


@router.get("/{target_id}/districts/{district_id}/months", response_model=MonthAllocationResponse)
def list_month_allocations(
    target_id: uuid.UUID, district_id: uuid.UUID, db: DbSession, _: CurrentUser
) -> MonthAllocationResponse:
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    return _month_response(_district_target(target, district_id))


@router.put("/{target_id}/districts/{district_id}/months", response_model=TargetDetail)
def set_month_targets(
    target_id: uuid.UUID,
    district_id: uuid.UUID,
    payload: MonthAllocationPayload,
    db: DbSession,
    admin: AdminUser,
) -> TargetDetail:
    """Replace the monthly phasing of one district (optionally of all districts)."""
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    dt = _district_target(target, district_id)
    changing = list(target.district_targets) if payload.apply_to_all_districts else [dt]

    old = {d.district_id: _months_snapshot(d) for d in changing}
    try:
        for d in changing:
            if payload.mode == "even":
                split_months_evenly(db, d, actor_id=admin.id)
            else:
                replace_monthly_percents(
                    db, d, {m.month: m.percent for m in payload.months}, actor_id=admin.id
                )
    except TargetAllocationError as exc:
        db.rollback()
        raise _unprocessable(str(exc))

    old_audit: dict[str, dict[str, str]] = {}
    new_audit: dict[str, dict[str, str]] = {}
    for d in changing:
        before, after = _months_diff(old[d.district_id], _months_snapshot(d))
        if before:  # skip districts where nothing changed
            old_audit[d.district.name] = before
            new_audit[d.district.name] = after

    if new_audit:
        record_audit(
            db,
            action=AuditAction.UPDATE,
            obj=target,
            actor_id=admin.id,
            old_values={"district_months": old_audit},
            new_values={"district_months": new_audit},
        )
    db.commit()
    db.refresh(target)
    return _detail(db, target, admin) 

@router.get("/{target_id}/performance", response_model=TargetPerformance)
def get_target_performance(
    target_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
    metric: Literal["amount", "count"] = Query("amount"),
    district_id: uuid.UUID | None = Query(None, description="Only this district"),
) -> dict:
    """Actual vs target per district, annually and per month."""
    target = get_or_404(service_type_target_crud, db, target_id, LABEL)
    return target_performance(db, target, metric=metric, district_id=district_id)