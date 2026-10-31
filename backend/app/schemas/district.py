from pydantic import BaseModel, Field

from app.core.enums import Status
from app.schemas.base import AuditRead


class DistrictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: Status = Status.ACTIVE


class DistrictUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    status: Status | None = None


class DistrictRead(AuditRead):
    name: str
    description: str | None
