import uuid

from pydantic import BaseModel, ConfigDict


class UserRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str                      # (adjust) to your User columns
    full_name: str | None = None    # (adjust)


class AuditStamp(BaseModel):
    """Who created / last updated a record. Admin only."""
    created_by: UserRef | None = None
    updated_by: UserRef | None = None