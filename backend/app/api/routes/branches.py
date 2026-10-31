import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import conflict, get_or_404
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.models import Agent, Branch
from app.schemas.branch import BranchCreate, BranchRead, BranchUpdate

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchRead])
def list_branches(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    district_id: uuid.UUID | None = None,
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search by name"),
) -> list[Branch]:
    conditions = []
    if district_id:
        conditions.append(Branch.district_id == district_id)
    if status_:
        conditions.append(Branch.status == status_)
    if q:
        conditions.append(Branch.name.ilike(f"%{q}%"))
    return branch_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{branch_id}", response_model=BranchRead)
def get_branch(branch_id: uuid.UUID, db: DbSession, _: CurrentUser) -> Branch:
    return get_or_404(branch_crud, db, branch_id, "Branch")


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
def create_branch(payload: BranchCreate, db: DbSession, admin: AdminUser) -> Branch:
    get_or_404(district_crud, db, payload.district_id, "District")
    return branch_crud.create(db, payload.model_dump(), actor_id=admin.id)


@router.patch("/{branch_id}", response_model=BranchRead)
def update_branch(
    branch_id: uuid.UUID, payload: BranchUpdate, db: DbSession, admin: AdminUser
) -> Branch:
    branch = get_or_404(branch_crud, db, branch_id, "Branch")
    data = payload.model_dump(exclude_unset=True)
    if data.get("district_id"):
        get_or_404(district_crud, db, data["district_id"], "District")
    return branch_crud.update(db, branch, data, actor_id=admin.id)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    branch = get_or_404(branch_crud, db, branch_id, "Branch")
    if agent_crud.count(db, Agent.branch_id == branch_id):
        raise conflict("Branch still has agents; delete or move them first")
    branch_crud.soft_delete(db, branch, actor_id=admin.id)
