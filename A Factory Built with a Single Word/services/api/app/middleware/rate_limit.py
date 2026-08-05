from __future__ import annotations

import logging
import os
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("ican.api.ratelimit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-process sliding-window rate limiter.

    IMPORTANT — single-process limitation:
    This limiter uses an in-memory ``deque`` and a ``threading.Lock``.  When
    the API is deployed with multiple ASGI workers (e.g. ``gunicorn -w 4``
    or ``uvicorn --workers 4``), **each worker has its own independent
    counter**.  The effective limit becomes ``configured_limit × worker_count``.

    For production multi-worker deployments, either:
    1. Run a single worker (recommended for SQLite-based deployments), or
    2. Replace this middleware with a Redis-backed distributed limiter, or
    3. Set ``RATE_LIMIT_WORKER_COUNT`` to the actual worker count — the
       configured limits will be divided by that factor so the aggregate
       remains correct.
    """

    def __init__(self, app, *, default_limit: int, auth_limit: int, window_seconds: int = 60):
        super().__init__(app)
        self.default_limit = default_limit
        self.auth_limit = auth_limit
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

        # Detect multi-worker deployment and warn / adjust limits.
        worker_count = max(1, int(os.environ.get("RATE_LIMIT_WORKER_COUNT", "1")))
        web_concurrency = max(1, int(os.environ.get("WEB_CONCURRENCY", "1")))
        effective_workers = max(worker_count, web_concurrency)
        if effective_workers > 1:
            logger.warning(
                "RateLimitMiddleware: detected %d workers. In-memory limiter "
                "is per-process; effective limit = configured × %d. "
                "Dividing configured limits by worker count to compensate.",
                effective_workers,
                effective_workers,
            )
            self.default_limit = max(1, default_limit // effective_workers)
            self.auth_limit = max(1, auth_limit // effective_workers)

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
                    content={
                        "detail": {
                            "code": "RATE_LIMITED",
                            "message": "请求过于频繁，请稍后重试",
                        }
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Scope": "single-process",
                    },
                )
            bucket.append(now)
            remaining = max(0, limit - len(bucket))

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Scope"] = "single-process"
        return response
