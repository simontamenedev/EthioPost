import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.api.utils import bad_request, get_or_404
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.models import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.api.audit import build_stamp, is_admin
from app.schemas.agent import AgentCreate, AgentDetail, AgentRead, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


def _validate_location(db: Session, branch_id: uuid.UUID, district_id: uuid.UUID) -> None:
    """Branch and district must exist, and the branch must belong to that district."""
    get_or_404(district_crud, db, district_id, "District")
    branch = get_or_404(branch_crud, db, branch_id, "Branch")
    if branch.district_id != district_id:
        raise bad_request("Branch does not belong to the given district")


@router.get("", response_model=list[AgentRead])
def list_agents(
    db: DbSession,
    _: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    branch_id: uuid.UUID | None = None,
    district_id: uuid.UUID | None = None,
    parent_shortcode: str | None = None,
    status_: Status | None = Query(None, alias="status"),
    q: str | None = Query(None, description="Search agent name or shortcode"),
) -> list[Agent]:
    conditions = []
    if branch_id:
        conditions.append(Agent.branch_id == branch_id)
    if district_id:
        conditions.append(Agent.district_id == district_id)
    if parent_shortcode:
        conditions.append(Agent.parent_shortcode == parent_shortcode)
    if status_:
        conditions.append(Agent.status == status_)
    if q:
        like = f"%{q}%"
        conditions.append(Agent.agent_name.ilike(like) | Agent.agent_shortcode.ilike(like))
    return agent_crud.get_multi(db, *conditions, skip=skip, limit=limit)


@router.get("/{agent_id}", response_model=AgentDetail)
def get_agent(agent_id: uuid.UUID, db: DbSession, user: CurrentUser) -> AgentDetail:
    agent = get_or_404(agent_crud, db, agent_id, "Agent")
    return AgentDetail.model_validate(agent).model_copy(
        update={"audit": build_stamp(db, agent) if is_admin(user) else None}
    )

@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: DbSession, admin: AdminUser) -> Agent:
    _validate_location(db, payload.branch_id, payload.district_id)
    return agent_crud.create(db, payload.model_dump(), actor_id=admin.id)


@router.patch("/{agent_id}", response_model=AgentRead)
def update_agent(agent_id: uuid.UUID, payload: AgentUpdate, db: DbSession, admin: AdminUser) -> Agent:
    agent = get_or_404(agent_crud, db, agent_id, "Agent")
    data = payload.model_dump(exclude_unset=True)
    if "branch_id" in data or "district_id" in data:
        _validate_location(
            db,
            data.get("branch_id") or agent.branch_id,
            data.get("district_id") or agent.district_id,
        )
    return agent_crud.update(db, agent, data, actor_id=admin.id)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: uuid.UUID, db: DbSession, admin: AdminUser) -> None:
    agent = get_or_404(agent_crud, db, agent_id, "Agent")
    agent_crud.soft_delete(db, agent, actor_id=admin.id)
