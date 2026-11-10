import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, DbSession
from app.core.enums import Status
from app.crud import agent_crud, branch_crud, district_crud
from app.crud.base import CRUDBase
from app.models import Agent, Branch, District
from app.schemas.dashboard import CountStat, DashboardStats
from app.services import dashboard as dash
from app.services.analytics import DataFilters

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


@router.get("/overview")
def dashboard_overview(
    db: DbSession,
    _: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
    fsp_id: uuid.UUID | None = None,
    top: int = Query(5, ge=1, le=50),
):
    """Everything on the home dashboard for one date range (optionally one provider)."""
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "date_from must be on or before date_to")
    f = DataFilters(date_from=date_from, date_to=date_to, fsp_id=fsp_id)
    return dash.dashboard_overview(db, f, top=top)