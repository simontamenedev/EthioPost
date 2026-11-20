from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_model import BaseEntity, active_unique_index


class District(BaseEntity):
    __tablename__ = "districts"
    __table_args__ = (active_unique_index("uq_districts_name_active", "name"),)

    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)

    # Self-reference: Ethio Post districts are roots (parent_id IS NULL),
    # Ethio Telecom regions point to the Ethio Post district they align with.
    # NOTE: the type must match BaseEntity.id (int here; change if you use UUID).
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("districts.id", ondelete="RESTRICT"), index=True
    )

    parent: Mapped["District | None"] = relationship(
        back_populates="children", remote_side="District.id"
    )
    children: Mapped[list["District"]] = relationship(back_populates="parent")