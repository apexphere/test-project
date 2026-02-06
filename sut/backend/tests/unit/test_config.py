"""Unit tests for app.config module."""
import os
from unittest.mock import patch

import pytest

from app.config import Settings, get_settings


class TestSettings:
    """Tests for Settings configuration."""

    def test_default_settings(self):
        """Settings have correct defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
        
        assert settings.app_name == "Mini E-commerce API"
        assert settings.debug is False
        assert settings.database_url == "sqlite:///./ecommerce.db"
        assert settings.redis_url == "redis://localhost:6379"
        assert settings.auth_service_url == "http://localhost:8001"
        assert settings.jwt_public_key == ""

    def test_settings_from_env_vars(self):
        """Settings can be overridden by environment variables."""
        env_vars = {
            "APP_NAME": "Test App",
            "DEBUG": "true",
            "DATABASE_URL": "postgresql://localhost/test",
            "REDIS_URL": "redis://redis:6379",
            "AUTH_SERVICE_URL": "http://auth:8001",
            "JWT_PUBLIC_KEY": "test-public-key",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()
        
        assert settings.app_name == "Test App"
        assert settings.debug is True
        assert settings.database_url == "postgresql://localhost/test"
        assert settings.redis_url == "redis://redis:6379"
        assert settings.auth_service_url == "http://auth:8001"
        assert settings.jwt_public_key == "test-public-key"

    def test_debug_false_by_default(self):
        """Debug mode is disabled by default."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
        
        assert settings.debug is False

    def test_debug_true_with_env_var(self):
        """Debug mode can be enabled via env var."""
        with patch.dict(os.environ, {"DEBUG": "1"}, clear=True):
            settings = Settings()
        
        assert settings.debug is True


class TestGetSettings:
    """Tests for get_settings function."""

    def test_returns_settings_instance(self):
        """get_settings returns a Settings instance."""
        # Clear the LRU cache to ensure fresh settings
        get_settings.cache_clear()
        
        result = get_settings()
        
        assert isinstance(result, Settings)

    def test_settings_are_cached(self):
        """get_settings returns cached instance."""
        get_settings.cache_clear()
        
        settings1 = get_settings()
        settings2 = get_settings()
        
        assert settings1 is settings2
