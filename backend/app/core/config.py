from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List

INSECURE_SECRETS = {"dev-secret-key", "your-secret-key-here", "changeme", "secret", ""}


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/geoconces"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None
    AUTO_CREATE_TABLES: bool = False
    SECRET_KEY: str  # required, no default — must come from env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    # Regex permisiva solo en development; en prod queda None.
    CORS_ORIGIN_REGEX: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    S3_BUCKET: str | None = None
    S3_REGION: str | None = None
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None

    # Rate limiting (puede deshabilitarse en tests)
    RATE_LIMIT_ENABLED: bool = True

    # Email (Resend). If RESEND_API_KEY is unset, sender falls back to no-op + log.
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "GeoConces <no-reply@geoconces.local>"
    EMAIL_REPLY_TO: str | None = None

    # Reports housekeeping
    REPORTS_TTL_DAYS: int = 7

    # Gemini Flash (OCR mejorado para expedientes). Si está vacío se usa Tesseract.
    GEMINI_API_KEY: str | None = None

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret(cls, v: str, info):
        env = (info.data.get("ENVIRONMENT") or "development").lower()
        if env == "production":
            if not v or v.strip() in INSECURE_SECRETS or len(v) < 32:
                raise ValueError(
                    "SECRET_KEY inseguro en producción: debe tener ≥32 caracteres "
                    "y no ser un placeholder. Genera uno con `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`."
                )
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def effective_cors_origin_regex(self) -> str | None:
        # En producción no se permite regex de localhost.
        return None if self.is_production else self.CORS_ORIGIN_REGEX

    class Config:
        env_file = ".env"


settings = Settings()
