from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.crud.base import CRUDBase
from app.models import Agent, Branch, District
from app.schemas.dashboard import CountStat, DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ACTIVE = Status("active")
INACTIVE = Status("inactive")


def _stat(db: DbSession, crud: CRUDBase, model) -> CountStat:
    return CountStat(
        total=crud.count(db),
        active=crud.count(db, model.status == ACTIVE),
        inactive=crud.count(db, model.status == INACTIVE),
    )


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: DbSession, _: CurrentUser) -> DashboardStats:
    """Totals for the dashboard cards (soft-deleted records are excluded)."""
    return DashboardStats(
        agents=_stat(db, agent_crud, Agent),
        branches=_stat(db, branch_crud, Branch),
        districts=_stat(db, district_crud, District),
    )