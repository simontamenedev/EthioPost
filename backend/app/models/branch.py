import uuid

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import BaseEntity, active_unique_index
from app.models.district import District


class Branch(BaseEntity):
    __tablename__ = "branches"
    __table_args__ = (active_unique_index("uq_branches_district_name_active", "district_id", "name"),)

    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    district_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("districts.id"), index=True)

    district: Mapped[District] = relationship(foreign_keys=[district_id])
