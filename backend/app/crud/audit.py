import uuid
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.audit_context import request_ctx
from app.core.enums import AuditAction
from app.db.base_model import BaseEntity
from app.models.audit_log import AuditLog

SENSITIVE_FIELDS = {"hashed_password"}


def _clean(values: dict[str, Any] | None) -> dict[str, Any] | None:
    """JSON-safe copy of the values, with sensitive fields redacted."""
    if values is None:
        return None
    safe = {k: ("[REDACTED]" if k in SENSITIVE_FIELDS else v) for k, v in values.items()}
    return jsonable_encoder(safe)


def snapshot(obj: BaseEntity) -> dict[str, Any]:
    """Raw column values of a model instance."""
    return {c.key: getattr(obj, c.key) for c in inspect(obj).mapper.column_attrs}


def record_audit(
    db: Session,
    *,
    action: AuditAction,
    obj: BaseEntity,
    actor_id: uuid.UUID,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
) -> None:
    """Stage an audit row in the caller's session. The caller commits."""
    ctx = request_ctx.get()
    db.add(
        AuditLog(
            user_id=actor_id,
            action=action.value,
            model_name=type(obj).__name__,
            record_id=obj.id,
            old_values=_clean(old_values),
            new_values=_clean(new_values),
            ip_address=ctx.get("ip_address"),
            user_agent=ctx.get("user_agent"),
            created_by=actor_id,
            updated_by=actor_id,
        )
    )