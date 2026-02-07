import logging
import warnings
from functools import lru_cache
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# Known weak/placeholder secrets that must not be used in production
WEAK_SECRET_PATTERNS = [
    "your-super-secret-key-change-in-production",
    "k8s-secret-key-change-in-production",
    "change-me",
    "changeme",
    "secret",
    "password",
    "123456",
]

MIN_SECRET_LENGTH = 32


class WeakSecretKeyError(ValueError):
    """Raised when SECRET_KEY is missing, too short, or matches a known weak pattern."""
    pass


# Patterns that indicate weak/placeholder secrets that should be rejected
WEAK_SECRET_PATTERNS = [
    "changeme",
    "password",
    "secret",
    "123456",
    "admin",
    "default",
    "test",
    "example",
]


# Patterns that indicate weak/placeholder secrets that should be rejected
WEAK_SECRET_PATTERNS = [
    "changeme",
    "password",
    "secret",
    "123456",
    "admin",
    "default",
    "test",
    "example",
]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    app_name: str = "Mini E-commerce API"
    debug: bool = False
    
    # Database (SQLite for local dev, PostgreSQL for production)
    database_url: str = "sqlite:///./ecommerce.db"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Auth Service
    auth_service_url: str = "http://localhost:8001"
    jwt_public_key: str = ""  # Falls back to fetching from auth service
    
    # Legacy — kept for reference but no longer used for JWT
    # MUST be set via SECRET_KEY env var; no default provided
    secret_key: Optional[str] = None
    access_token_expire_minutes: int = 30
    
    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: Optional[str]) -> Optional[str]:
        """Validate that secret_key is not weak or missing.
        
        In debug mode, emits a warning but allows the app to start.
        In production (debug=False), raises WeakSecretKeyError.
        
        Note: We can't access self.debug here, so we check the env var directly.
        """
        import os
        is_debug = os.getenv("DEBUG", "").lower() in ("true", "1", "yes")
        
        # Check if secret is missing or empty
        if not v or not v.strip():
            msg = "SECRET_KEY environment variable is not set"
            if is_debug:
                warnings.warn(f"{msg} — using insecure default for development only", stacklevel=2)
                return "INSECURE-DEV-KEY-DO-NOT-USE-IN-PRODUCTION"
            raise WeakSecretKeyError(msg)
        
        v = v.strip()
        
        # Check minimum length
        if len(v) < MIN_SECRET_LENGTH:
            msg = f"SECRET_KEY must be at least {MIN_SECRET_LENGTH} characters (got {len(v)})"
            if is_debug:
                warnings.warn(f"{msg} — continuing in debug mode", stacklevel=2)
                return v
            raise WeakSecretKeyError(msg)
        
        # Check against known weak patterns
        v_lower = v.lower()
        for pattern in WEAK_SECRET_PATTERNS:
            if pattern in v_lower:
                msg = f"SECRET_KEY contains weak/placeholder pattern: '{pattern}'"
                if is_debug:
                    warnings.warn(f"{msg} — continuing in debug mode", stacklevel=2)
                    return v
                raise WeakSecretKeyError(msg)
        
        return v
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
