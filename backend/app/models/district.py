from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_model import BaseEntity, active_unique_index


class District(BaseEntity):
    __tablename__ = "districts"
    __table_args__ = (active_unique_index("uq_districts_name_active", "name"),)

    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
