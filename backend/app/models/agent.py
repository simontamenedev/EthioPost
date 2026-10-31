import uuid

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import BaseEntity, active_unique_index
from app.models.branch import Branch
from app.models.district import District


class Agent(BaseEntity):
    __tablename__ = "agents"
    __table_args__ = (active_unique_index("uq_agents_shortcode_active", "agent_shortcode"),)

    parent_shortcode: Mapped[str | None] = mapped_column(String(50), index=True)
    agent_shortcode: Mapped[str] = mapped_column(String(50))
    agent_name: Mapped[str] = mapped_column(String(150))
    company_service_number: Mapped[str | None] = mapped_column(String(50))
    remark: Mapped[str | None] = mapped_column(Text)

    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), index=True)
    district_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("districts.id"), index=True)

    branch: Mapped[Branch] = relationship(foreign_keys=[branch_id])
    district: Mapped[District] = relationship(foreign_keys=[district_id])
