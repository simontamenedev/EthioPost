from contextvars import ContextVar
from typing import TypedDict


class RequestContext(TypedDict, total=False):
    ip_address: str | None
    user_agent: str | None


request_ctx: ContextVar[RequestContext] = ContextVar("request_ctx", default={})