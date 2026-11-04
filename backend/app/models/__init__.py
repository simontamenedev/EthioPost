# Import every model so Base.metadata knows about all tables (Alembic relies on this).
from app.models.agent import Agent
from app.models.branch import Branch
from app.models.district import District
from app.core.enums import Status, UserRole
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.password_reset_token import PasswordResetToken
from app.models.agent_data import AgentTransaction, CustomerRegistration, CustomerUpgrade
from app.models.import_batch import ImportBatch

__all__ = ["Agent", "Branch", "District", "Status", "User", "UserRole","AuditLog","PasswordResetToken", "AgentTransaction",
    "CustomerRegistration",
    "CustomerUpgrade",
    "ImportBatch",]
