import enum


class Status(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class UserRole(str, enum.Enum):
    ADMIN = "admin"  # full access
    USER = "user"  # read-only

class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class CommissionType(str, enum.Enum):
    FLAT = "flat"        # fixed ETB amount (e.g. 18 Birr, 1 Birr per txn)
    PERCENT = "percent"  # percentage of `basis` (e.g. 15% of sold amount)
 
 
class CommissionBasis(str, enum.Enum):
    """What a PERCENT rate is applied to (ignored for FLAT)."""
    TXN_AMOUNT = "txn_amount"        # the transaction / sold amount
    FEE_COLLECTED = "fee_collected"  # charges collected from customers ("75% of charges")
    REVENUE = "revenue"              # revenue generated (annuity: 5% of revenue)    