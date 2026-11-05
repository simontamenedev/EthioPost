import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DbSession
from app.core.enums import AuditAction
from app.crud import audit_log_crud
from app.models import AuditLog
from app.schemas.audit_log import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

# Eager-load the acting user in one extra query instead of one lazy load per log row.
_WITH_USER = (selectinload(AuditLog.user),)


def _model_cond(model_name: str):
    return func.lower(AuditLog.model_name) == model_name.lower()


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    db: DbSession,
    _: AdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    model_name: str | None = None,
    record_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    action: AuditAction | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[AuditLog]:
    """All audit logs, newest first, with optional filters."""
    conditions = []
    if model_name:
        conditions.append(_model_cond(model_name))
    if record_id:
        conditions.append(AuditLog.record_id == record_id)
    if user_id:
        conditions.append(AuditLog.user_id == user_id)
    if action:
        conditions.append(AuditLog.action == action.value)
    if date_from:
        conditions.append(AuditLog.created_at >= date_from)
    if date_to:
        conditions.append(AuditLog.created_at <= date_to)
    return audit_log_crud.get_multi(
        db, *conditions, skip=skip, limit=limit, options=_WITH_USER
    )


@router.get("/{model_name}", response_model=list[AuditLogRead])
def list_audit_logs_by_model(
    model_name: str,
    db: DbSession,
    _: AdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLog]:
    """Audit trail for every record of one model, e.g. /audit-logs/Agent."""
    return audit_log_crud.get_multi(
        db, _model_cond(model_name), skip=skip, limit=limit, options=_WITH_USER
    )


@router.get("/{model_name}/{record_id}", response_model=list[AuditLogRead])
def list_audit_logs_by_record(
    model_name: str,
    record_id: uuid.UUID,
    db: DbSession,
    _: AdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[AuditLog]:
    """Full history of one record, e.g. /audit-logs/Agent/<uuid>."""
    return audit_log_crud.get_multi(
        db,
        _model_cond(model_name),
        AuditLog.record_id == record_id,
        skip=skip,
        limit=limit,
        options=_WITH_USER,
    )