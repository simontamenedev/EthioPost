import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.api.audit import build_stamp, is_admin
from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.models import Agent, Branch, District
from app.schemas.district import DistrictCreate, DistrictDetail, DistrictRead, DistrictUpdate
from app.services.district_tree import child_ids

router = APIRouter(prefix="/districts", tags=["districts"])


def _check_parent(db: DbSession, parent_id: uuid.UUID | None, district: District | None = None) -> None:
    """The hierarchy has two levels: a parent district never has a parent of its own."""
    if parent_id is None:
        return
    if district is not None and parent_id == district.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A district cannot be its own parent")
    parent = get_or_404(district_crud, db, parent_id, "Parent district")
    if parent.parent_id is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The parent must be a top-level district")
    if district is not None and child_ids(db, district.id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "This district has child districts, so it cannot be given a parent",
        )


@router.get("", response_model=list[DistrictRead])
def list_districts(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by name"),
    parents_only: bool = Query(False, description="Only top-level (parent) districts"),
    parent_id: uuid.UUID | None = Query(None, description="Only the children of this district"),
) -> list[District]:
    conditions = []
    if status_:
        conditions.append(District.status == status_)
    if q:
        conditions.append(District.name.ilike(f"%{q}%"))
    if parents_only:
        conditions.append(District.parent_id.is_(None))
    if parent_id:
        conditions.append(District.parent_id == parent_id)
    return district_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{district_id}/children", response_model=list[DistrictRead])
def list_children(
    district_id: uuid.UUID,
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
) -> list[District]:
    get_or_404(district_crud, db, district_id, "District")
    return district_crud.get_multi(db, District.parent_id == district_id, skip=skip, limit=limit)


@router.get("/{district_id}", response_model=DistrictDetail)
def get_district(district_id: uuid.UUID, db: DbSession, user: CurrentUser) -> DistrictDetail:
    district = get_or_404(district_crud, db, district_id, "District")
    children = district_crud.get_multi(db, District.parent_id == district_id, limit=500)
    scope = [district_id, *(c.id for c in children)]  # counts roll up from the children
    return DistrictDetail.model_validate(district).model_copy(
        update={
            "parent_name": district.parent.name if district.parent else None,
            "children": [DistrictRead.model_validate(c) for c in children],
            "branch_count": branch_crud.count(db, Branch.district_id.in_(scope)),
            "agent_count": agent_crud.count(db, Agent.district_id.in_(scope)),
            "audit": build_stamp(db, district) if is_admin(user) else None,
        }
    )


@router.post("", response_model=DistrictRead, status_code=status.HTTP_201_CREATED)
def create_district(payload: DistrictCreate, db: DbSession, admin: AdminUser) -> District:
    data = payload.model_dump()
    _check_parent(db, data.get("parent_id"))
    return district_crud.create(db, data, actor_id=admin.id)


@router.patch("/{district_id}", response_model=DistrictRead)
def update_district(
    district_id: uuid.UUID, payload: DistrictUpdate, db: DbSession, admin: AdminUser
) -> District:
    district = get_or_404(district_crud, db, district_id, "District")
    data = payload.model_dump(exclude_unset=True)
    if "parent_id" in data:
        _check_parent(db, data["parent_id"], district)
    return district_crud.update(db, district, data, actor_id=admin.id)


@router.delete("/{district_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_district(district_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    district = get_or_404(district_crud, db, district_id, "District")
    if child_ids(db, district_id):
        raise conflict("District still has child districts; delete or move them first")
    if branch_crud.count(db, Branch.district_id == district_id):
        raise conflict("District still has branches; delete or move them first")
    district_crud.soft_delete(db, district, actor_id=admin.id)