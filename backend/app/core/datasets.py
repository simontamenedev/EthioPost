import enum


class Dataset(str, enum.Enum):
    """The three CSV report types an admin can upload."""

    TRANSACTIONS = "transactions"
    REGISTRATIONS = "registrations"
    UPGRADES = "upgrades"