from fastapi import APIRouter

from app.api.routes import agents, auth, branches, districts, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(districts.router)
api_router.include_router(branches.router)
api_router.include_router(agents.router)
