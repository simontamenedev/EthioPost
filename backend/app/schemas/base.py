import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.enums import Status


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AuditRead(ORMModel):
    """Common read-only fields returned for every entity."""

    id: uuid.UUID
    status: Status
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
