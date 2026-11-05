import uuid

from pydantic import BaseModel, Field

from app.core.enums import Status
from app.schemas.base import AuditRead
from app.schemas.audit import AuditStamp
from app.schemas.district import DistrictRead

class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    district_id: uuid.UUID
    status: Status = Status.ACTIVE


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    district_id: uuid.UUID | None = None
    status: Status | None = None


class BranchRead(AuditRead):
    name: str
    description: str | None
    district_id: uuid.UUID

class BranchDetail(BranchRead):
    district: DistrictRead
    agent_count: int = 0
    audit: AuditStamp | None = None