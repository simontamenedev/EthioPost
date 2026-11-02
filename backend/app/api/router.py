from fastapi import APIRouter

from app.api.routes import agents, auth, branches, districts, users
from app.api.routes import agents, audit_logs, branches, dashboard, districts, users
from app.api.routes import audit_logs
from app.api.routes import account

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(districts.router)
api_router.include_router(branches.router)
api_router.include_router(agents.router)
api_router.include_router(dashboard.router)
api_router.include_router(audit_logs.router)
api_router.include_router(account.router)
