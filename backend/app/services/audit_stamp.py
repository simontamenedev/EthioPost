# app/services/audit_stamp.py   (skip if districts already have a helper that builds the `audit` stamp - reuse it)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base_model import BaseEntity
from app.models import User
from app.schemas.audit import AuditStamp, UserRef


def audit_stamp(db: Session, obj: BaseEntity) -> AuditStamp:
    """Who created / last updated a record, as small user references."""
    ids = {i for i in (obj.created_by, obj.updated_by) if i}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids)))} if ids else {}

    def ref(user_id):
        u = users.get(user_id) if user_id else None
        return UserRef(id=u.id, email=u.email, full_name=u.name) if u else None

    return AuditStamp(created_by=ref(obj.created_by), updated_by=ref(obj.updated_by))