from pydantic import BaseModel


class CountStat(BaseModel):
    total: int
    active: int
    inactive: int


class DashboardStats(BaseModel):
    agents: CountStat
    branches: CountStat
    districts: CountStat