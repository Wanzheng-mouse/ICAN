from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./ican.db"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    upload_dir: str = "./uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    expose_reset_token: bool = False
    environment: str = "development"
    log_level: str = "INFO"
    log_dir: str = "./logs"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    rate_limit_per_minute: int = 600
    auth_rate_limit_per_minute: int = 30
    frontend_url: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    # Agnes semantic analysis is opt-in only when a server-side key is
    # configured. Never expose this value to the browser or a VITE_ variable.
    agnes_api_key: str = ""
    agnes_base_url: str = "https://apihub.agnes-ai.com/v1"
    llm_model: str = "agnes-2.0-flash"
    # This timeout applies only to the outbound Agnes analysis request.
    agnes_request_timeout_seconds: int = 5 * 60
    llm_max_tokens: int = 8192
    # ---- Seed user credentials (development/demo only) ----
    # Override via environment variables; production deployments should leave
    # these unset so seed_users() creates no fallback accounts and forces
    # every operator to register through the normal flow.
    seed_admin_password: str = "ChangeMe-OnFirstLogin!"
    seed_demo_password: str = "ChangeMe-OnFirstLogin!"
    seed_admin_login: str = "admin"
    seed_demo_login: str = "lisi"
    seed_enabled: bool = True
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ICAN_", extra="ignore")

    @property
    def origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]

    @model_validator(mode="after")
    def protect_reset_tokens(self) -> Settings:
        if self.environment.lower() == "production" and self.expose_reset_token:
            raise ValueError("ICAN_EXPOSE_RESET_TOKEN must be false in production")
        return self


settings = Settings()
