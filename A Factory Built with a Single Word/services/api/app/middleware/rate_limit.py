from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Small in-process sliding-window limiter suitable for a single API instance."""

    def __init__(self, app, *, default_limit: int, auth_limit: int, window_seconds: int = 60):
        super().__init__(app)
        self.default_limit = default_limit
        self.auth_limit = auth_limit
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in {"/health", "/docs", "/openapi.json"}:
            return await call_next(request)

        is_auth = request.url.path.startswith("/api/v1/auth/")
        limit = self.auth_limit if is_auth else self.default_limit
        client = request.client.host if request.client else "unknown"
        bucket_key = f"{client}:{'auth' if is_auth else 'api'}"
        now = monotonic()

        with self.lock:
            bucket = self.requests[bucket_key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                return JSONResponse(
                    status_code=429,
                    content={"detail": {"code": "RATE_LIMITED", "message": "请求过于频繁，请稍后重试"}},
                    headers={"Retry-After": str(retry_after), "X-RateLimit-Limit": str(limit)},
                )
            bucket.append(now)
            remaining = max(0, limit - len(bucket))

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
