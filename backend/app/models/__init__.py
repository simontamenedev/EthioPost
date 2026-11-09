# app/models/__init__.py
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
from app.models.commission_rate import CommissionRate  # legacy: flat % per service
from app.models.financial_service_provider import FinancialServiceProvider
from app.models.service_type import ServiceType
from app.models.commission_rule import CommissionRule

__all__ = [
    "Agent", "Branch", "District", "Status", "User", "UserRole", "AuditLog",
    "PasswordResetToken", "AgentTransaction", "CustomerRegistration", "CustomerUpgrade",
    "ImportBatch", "CommissionRate",
    "FinancialServiceProvider", "ServiceType", "CommissionRule",
]