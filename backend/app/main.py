from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.router import api_router
from app.api.routes import health
from app.core.config import settings
from app.core.audit_context import request_ctx

app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
)
@app.middleware("http")
async def audit_context_middleware(request: Request, call_next):
    token = request_ctx.set(
        {
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
    )
    try:
        return await call_next(request)
    finally:
        request_ctx.reset(token)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={"detail": "Conflict: duplicate value or invalid reference"},
    )


app.include_router(health.router)
app.include_router(api_router, prefix=settings.api_v1_prefix)
