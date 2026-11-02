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