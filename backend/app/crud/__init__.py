from app.crud.base import CRUDBase
from app.models import Agent, AuditLog, Branch, District, User
from app.models import ImportBatch

import_batch_crud = CRUDBase(ImportBatch)
user_crud = CRUDBase(User)
district_crud = CRUDBase(District)
branch_crud = CRUDBase(Branch)
agent_crud = CRUDBase(Agent)
audit_log_crud = CRUDBase(AuditLog, audited=False)  # the log must not audit itself

__all__ = [
    "CRUDBase",
    "agent_crud",
    "audit_log_crud",
    "branch_crud",
    "district_crud",
    "user_crud",
    "import_batch_crud"
]