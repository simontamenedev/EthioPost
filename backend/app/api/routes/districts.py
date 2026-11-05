import uuid

from fastapi import APIRouter, Query, status

from app.api.audit import build_stamp, is_admin
from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.models import Agent, Branch, District
from app.schemas.district import DistrictCreate, DistrictDetail, DistrictRead, DistrictUpdate

router = APIRouter(prefix="/districts", tags=["districts"])


@router.get("", response_model=list[DistrictRead])
def list_districts(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by name"),
) -> list[District]:
    conditions = []
    if status_:
        conditions.append(District.status == status_)
    if q:
        conditions.append(District.name.ilike(f"%{q}%"))
    return district_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{district_id}", response_model=DistrictDetail)
def get_district(district_id: uuid.UUID, db: DbSession, user: CurrentUser) -> DistrictDetail:
    district = get_or_404(district_crud, db, district_id, "District")
    return DistrictDetail.model_validate(district).model_copy(
        update={
            "branch_count": branch_crud.count(db, Branch.district_id == district_id),
            "agent_count": agent_crud.count(db, Agent.district_id == district_id),
            "audit": build_stamp(db, district) if is_admin(user) else None,
        }
    )


@router.post("", response_model=DistrictRead, status_code=status.HTTP_201_CREATED)
def create_district(payload: DistrictCreate, db: DbSession, admin: AdminUser) -> District:
    return district_crud.create(db, payload.model_dump(), actor_id=admin.id)


@router.patch("/{district_id}", response_model=DistrictRead)
def update_district(
    district_id: uuid.UUID, payload: DistrictUpdate, db: DbSession, admin: AdminUser
) -> District:
    district = get_or_404(district_crud, db, district_id, "District")
    return district_crud.update(db, district, payload.model_dump(exclude_unset=True), actor_id=admin.id)


@router.delete("/{district_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_district(district_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    district = get_or_404(district_crud, db, district_id, "District")
    if branch_crud.count(db, Branch.district_id == district_id):
        raise conflict("District still has branches; delete or move them first")
    district_crud.soft_delete(db, district, actor_id=admin.id)