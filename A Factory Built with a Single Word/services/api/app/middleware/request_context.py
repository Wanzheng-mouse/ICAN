"""Request tracing middleware.

Every request gets a stable ``request_id`` (either echoed from the caller's
``X-Request-ID`` header or generated server-side).  The id is:

* exposed on the response as ``X-Request-ID`` so frontends / support can
  correlate failures with backend logs;
* attached to structured log records emitted while the request is in flight;
* stored on ``request.state.request_id`` so exception handlers can embed it
  in the JSON error envelope.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("ican.api")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


class _RequestIdFilter(logging.Filter):
    """Attach the active request id to every record handled by the logger."""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = _request_id.get()
        if request_id:
            record.request_id = request_id
        return True


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # One filter instance is safe to share across handlers: it only reads
        # the contextvar at format time.
        self._filter = _RequestIdFilter()
        for handler in logging.getLogger().handlers:
            if not any(isinstance(item, _RequestIdFilter) for item in handler.filters):
                handler.addFilter(self._filter)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("X-Request-ID")
        request_id = incoming.strip() if incoming and incoming.strip() else uuid4().hex
        request.state.request_id = request_id
        token = _request_id.set(request_id)
        try:
            response = await call_next(request)
        finally:
            _request_id.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response
