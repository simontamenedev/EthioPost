# app/schemas/audit.py   (skip this file if you already have UserRef / AuditStamp schemas for districts - reuse those)
import uuid

from pydantic import BaseModel


class UserRef(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None


class AuditStamp(BaseModel):
    created_by: UserRef | None = None
    updated_by: UserRef | None = None