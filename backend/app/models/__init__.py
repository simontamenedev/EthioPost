# Import every model so Base.metadata knows about all tables (Alembic relies on this).
from app.models.agent import Agent
from app.models.branch import Branch
from app.models.district import District
from app.core.enums import Status, UserRole
from app.models.user import User

__all__ = ["Agent", "Branch", "District", "Status", "User", "UserRole"]
