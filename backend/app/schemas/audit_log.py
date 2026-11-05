import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.audit import UserRef


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    model_name: str
    record_id: uuid.UUID
    user_id: uuid.UUID | None = None
    user: UserRef | None = None
    old_values: dict | None = None
    new_values: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

class UserRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str                  # (adjust) to your User columns
    full_name: str | None = None


class AuditStamp(BaseModel):
    created_by: UserRef | None = None
    updated_by: UserRef | None = None    