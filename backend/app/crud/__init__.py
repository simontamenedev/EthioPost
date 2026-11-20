from app.crud.base import CRUDBase
from app.models import Agent, AuditLog, Branch, District,CommissionRate, User,FinancialServiceProvider,ServiceType,CommissionRule,ServiceTypeTargetPeriod
from app.models import ImportBatch, ServiceTypeTarget

commission_rate_crud = CRUDBase(CommissionRate)
import_batch_crud = CRUDBase(ImportBatch)
user_crud = CRUDBase(User)
district_crud = CRUDBase(District)
branch_crud = CRUDBase(Branch)
agent_crud = CRUDBase(Agent)
audit_log_crud = CRUDBase(AuditLog, audited=False)  # the log must not audit itself
fsp_crud = CRUDBase(FinancialServiceProvider)
service_type_crud = CRUDBase(ServiceType)
commission_rule_crud = CRUDBase(CommissionRule)
service_type_target_crud = CRUDBase(ServiceTypeTarget)
service_type_target_period_crud = CRUDBase(ServiceTypeTargetPeriod)

__all__ = [
    "CRUDBase",
    "agent_crud",
    "audit_log_crud",
    "branch_crud",
    "district_crud",
    "user_crud",
    "import_batch_crud",
    "fsp_crud",
    "service_type_crud",
    "commission_rule_crud",
    "service_type_target_crud",
]