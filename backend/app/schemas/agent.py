import uuid

from pydantic import BaseModel, Field

from app.core.enums import Status
from app.schemas.base import AuditRead


class AgentCreate(BaseModel):
    parent_shortcode: str | None = Field(default=None, max_length=50)
    agent_shortcode: str = Field(min_length=1, max_length=50)
    agent_name: str = Field(min_length=1, max_length=150)
    company_service_number: str | None = Field(default=None, max_length=50)
    remark: str | None = None
    branch_id: uuid.UUID
    district_id: uuid.UUID
    status: Status = Status.ACTIVE


class AgentUpdate(BaseModel):
    parent_shortcode: str | None = Field(default=None, max_length=50)
    agent_shortcode: str | None = Field(default=None, min_length=1, max_length=50)
    agent_name: str | None = Field(default=None, min_length=1, max_length=150)
    company_service_number: str | None = Field(default=None, max_length=50)
    remark: str | None = None
    branch_id: uuid.UUID | None = None
    district_id: uuid.UUID | None = None
    status: Status | None = None


class AgentRead(AuditRead):
    parent_shortcode: str | None
    agent_shortcode: str
    agent_name: str
    company_service_number: str | None
    remark: str | None
    branch_id: uuid.UUID
    district_id: uuid.UUID
