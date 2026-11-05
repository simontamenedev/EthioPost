from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base_model import BaseEntity
from app.models import User
from app.schemas.audit import AuditStamp, UserRef


def is_admin(user: User) -> bool:
    # (adjust) must mirror whatever the AdminUser dependency in deps.py checks
    return user.role == "admin"


def build_stamp(db: Session, record: BaseEntity) -> AuditStamp:
    ids = {record.created_by, record.updated_by} - {None}
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(ids)))} if ids else {}

    def ref(uid):
        return UserRef.model_validate(users[uid]) if uid in users else None

    return AuditStamp(created_by=ref(record.created_by), updated_by=ref(record.updated_by))