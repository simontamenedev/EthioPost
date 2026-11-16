from fastapi import APIRouter

from app.api.routes import agents, auth, branches, districts, users
from app.api.routes import (
    account, agents, analytics, audit_logs, auth, branches, commission_rates,
    commission_rules, dashboard, districts, fsps, imports, service_type_targets,
    service_types, users,
)
from app.api.routes import audit_logs
from app.api.routes import account
from app.api.routes import analytics, imports


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(districts.router)
api_router.include_router(branches.router)
api_router.include_router(agents.router)
api_router.include_router(dashboard.router)
api_router.include_router(audit_logs.router)
api_router.include_router(account.router)
api_router.include_router(imports.router)
api_router.include_router(analytics.router)
api_router.include_router(commission_rates.router)
api_router.include_router(fsps.router)
api_router.include_router(service_types.router)
api_router.include_router(commission_rules.router)
api_router.include_router(service_type_targets.router)
