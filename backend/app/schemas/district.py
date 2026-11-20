import uuid

from pydantic import BaseModel, Field

from app.core.enums import Status
from app.schemas.base import AuditRead
from app.schemas.audit import AuditStamp

class DistrictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: Status = Status.ACTIVE
    parent_id: uuid.UUID | None = None


class DistrictUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: Status | None = None
    parent_id: uuid.UUID | None


class DistrictRead(AuditRead):
    name: str
    description: str | None

class DistrictDetail(DistrictRead):
    branch_count: int = 0
    agent_count: int = 0
    audit: AuditStamp | None = None    
    parent_name: str | None = None
    children: list[DistrictRead] = []
