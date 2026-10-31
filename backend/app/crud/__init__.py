from app.crud.base import CRUDBase
from app.models import Agent, Branch, District, User

user_crud = CRUDBase(User)
district_crud = CRUDBase(District)
branch_crud = CRUDBase(Branch)
agent_crud = CRUDBase(Agent)

__all__ = ["CRUDBase", "agent_crud", "branch_crud", "district_crud", "user_crud"]
