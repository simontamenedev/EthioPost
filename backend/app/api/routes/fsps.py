# app/api/routes/fsps.py
import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import func

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status, UserRole
from app.crud import commission_rule_crud, fsp_crud, import_batch_crud
from app.models import CommissionRule, FinancialServiceProvider as Fsp, ImportBatch
from app.schemas.financial_service_provider import FspCreate, FspDetail, FspRead, FspUpdate
from app.services.audit_stamp import audit_stamp

router = APIRouter(prefix="/fsps", tags=["fsps"])


def _norm(v: str) -> str:
    return " ".join(v.split())


def _ensure_unique(db, *, code: str | None = None, name: str | None = None, exclude_id: uuid.UUID | None = None) -> None:
    for column, value, label in ((Fsp.code, code, "code"), (Fsp.name, name, "name")):
        if not value:
            continue
        conditions = [func.lower(column) == value.lower()]
        if exclude_id:
            conditions.append(Fsp.id != exclude_id)
        if fsp_crud.count(db, *conditions):
            raise conflict(f"A financial service provider with {label} “{value}” already exists")


@router.get("", response_model=list[FspRead])
def list_fsps(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by code or name"),
) -> list[Fsp]:
    conditions = []
    if status_:
        conditions.append(Fsp.status == status_)
    if q:
        like = f"%{q}%"
        conditions.append(Fsp.name.ilike(like) | Fsp.code.ilike(like))
    return fsp_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{fsp_id}", response_model=FspDetail)
def get_fsp(fsp_id: uuid.UUID, db: DbSession, user: CurrentUser) -> FspDetail:
    fsp = get_or_404(fsp_crud, db, fsp_id, "Financial service provider")
    return FspDetail.model_validate(fsp).model_copy(update={
        "rule_count": commission_rule_crud.count(db, CommissionRule.fsp_id == fsp.id),
        "import_count": import_batch_crud.count(db, ImportBatch.fsp_id == fsp.id),
        "audit": audit_stamp(db, fsp) if user.role == UserRole.ADMIN else None,
    })


@router.post("", response_model=FspRead, status_code=status.HTTP_201_CREATED)
def create_fsp(payload: FspCreate, db: DbSession, admin: AdminUser) -> Fsp:
    data = payload.model_dump()
    data["code"], data["name"] = _norm(data["code"]).upper().replace(" ", "_"), _norm(data["name"])
    _ensure_unique(db, code=data["code"], name=data["name"])
    return fsp_crud.create(db, data, actor_id=admin.id)


@router.patch("/{fsp_id}", response_model=FspRead)
def update_fsp(fsp_id: uuid.UUID, payload: FspUpdate, db: DbSession, admin: AdminUser) -> Fsp:
    fsp = get_or_404(fsp_crud, db, fsp_id, "Financial service provider")
    data = payload.model_dump(exclude_unset=True)
    if data.get("code"):
        data["code"] = _norm(data["code"]).upper().replace(" ", "_")
    if data.get("name"):
        data["name"] = _norm(data["name"])
    _ensure_unique(db, code=data.get("code"), name=data.get("name"), exclude_id=fsp.id)
    return fsp_crud.update(db, fsp, data, actor_id=admin.id)


@router.delete("/{fsp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fsp(fsp_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    fsp = get_or_404(fsp_crud, db, fsp_id, "Financial service provider")
    if commission_rule_crud.count(db, CommissionRule.fsp_id == fsp.id):
        raise conflict("This provider still has commission rules. Delete them first.")
    if import_batch_crud.count(db, ImportBatch.fsp_id == fsp.id):
        raise conflict("This provider has imported data. Roll back its imports first.")
    fsp_crud.soft_delete(db, fsp, actor_id=admin.id)