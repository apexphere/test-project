from pydantic_settings import BaseSettings
from functools import lru_cache


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
    secret_key: str = "your-super-secret-key-change-in-production"
    access_token_expire_minutes: int = 30
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
