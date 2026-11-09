# ───────────────────────── 1. schemas ─────────────────────────
# app/schemas/financial_service_provider.py  - add
from app.schemas.audit import AuditStamp


class FspDetail(FspRead):
    rule_count: int = 0
    import_count: int = 0
    audit: AuditStamp | None = None


# app/schemas/service_type.py  - add
from app.schemas.audit import AuditStamp


class ServiceTypeDetail(ServiceTypeRead):
    rule_count: int = 0
    audit: AuditStamp | None = None


# app/schemas/commission_rule.py  - add
from app.schemas.audit import AuditStamp


class CommissionRuleDetail(CommissionRuleRead):
    audit: AuditStamp | None = None


# ───────────────────────── 2. routes/fsps.py ─────────────────────────
# extra imports
from app.core.enums import UserRole
from app.schemas.financial_service_provider import FspDetail
from app.services.audit_stamp import audit_stamp


# REPLACE get_fsp with:
@router.get("/{fsp_id}", response_model=FspDetail)
def get_fsp(fsp_id: uuid.UUID, db: DbSession, user: CurrentUser) -> FspDetail:
    fsp = get_or_404(fsp_crud, db, fsp_id, "Financial service provider")
    return FspDetail.model_validate(fsp).model_copy(update={
        "rule_count": commission_rule_crud.count(db, CommissionRule.fsp_id == fsp.id),
        "import_count": import_batch_crud.count(db, ImportBatch.fsp_id == fsp.id),
        "audit": audit_stamp(db, fsp) if user.role == UserRole.ADMIN else None,
    })


# ───────────────────────── 3. routes/service_types.py ─────────────────────────
from app.core.enums import UserRole
from app.schemas.service_type import ServiceTypeDetail
from app.services.audit_stamp import audit_stamp


# REPLACE get_service_type with:
@router.get("/{service_type_id}", response_model=ServiceTypeDetail)
def get_service_type(service_type_id: uuid.UUID, db: DbSession, user: CurrentUser) -> ServiceTypeDetail:
    obj = get_or_404(service_type_crud, db, service_type_id, "Service type")
    return ServiceTypeDetail.model_validate(obj).model_copy(update={
        "rule_count": commission_rule_crud.count(db, CommissionRule.service_type_id == obj.id),
        "audit": audit_stamp(db, obj) if user.role == UserRole.ADMIN else None,
    })


# ───────────────────────── 4. routes/commission_rules.py ─────────────────────────
from app.core.enums import UserRole
from app.schemas.commission_rule import CommissionRuleDetail
from app.services.audit_stamp import audit_stamp


# REPLACE get_commission_rule with:
@router.get("/{rule_id}", response_model=CommissionRuleDetail)
def get_commission_rule(rule_id: uuid.UUID, db: DbSession, user: CurrentUser) -> CommissionRuleDetail:
    rule = get_or_404(commission_rule_crud, db, rule_id, "Commission rule")
    return CommissionRuleDetail.model_validate(rule).model_copy(update={
        "audit": audit_stamp(db, rule) if user.role == UserRole.ADMIN else None,
    })