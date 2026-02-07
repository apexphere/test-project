"""Unit tests for app.config module."""
import os
import warnings
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.config import (
    Settings,
    get_settings,
    WeakSecretKeyError,
    WEAK_SECRET_PATTERNS,
    MIN_SECRET_LENGTH,
)


# A valid strong key for tests (meets length, avoids weak patterns)
# Must not contain: secret, password, change-me, changeme, 123456, etc.
VALID_SECRET = "xK9mPqL2nRtYvWzA8bCdEfGhJkMnPqRsTuVwXyZabcdefgh"


class TestSettings:
    """Tests for Settings configuration."""

    def test_default_settings_in_debug_mode(self):
        """Settings have correct defaults when DEBUG=true."""
        with patch.dict(os.environ, {"DEBUG": "true"}, clear=True):
            with warnings.catch_warnings(record=True):
                warnings.simplefilter("always")
                settings = Settings()
        
        assert settings.app_name == "Mini E-commerce API"
        assert settings.debug is True
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
            "SECRET_KEY": VALID_SECRET,
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            settings = Settings()
        
        assert settings.app_name == "Test App"
        assert settings.debug is True
        assert settings.database_url == "postgresql://localhost/test"
        assert settings.redis_url == "redis://redis:6379"
        assert settings.auth_service_url == "http://auth:8001"
        assert settings.jwt_public_key == "test-public-key"
        assert settings.secret_key == VALID_SECRET

    def test_debug_false_by_default(self):
        """Debug mode is disabled by default."""
        with patch.dict(os.environ, {"SECRET_KEY": VALID_SECRET}, clear=True):
            settings = Settings()
        
        assert settings.debug is False

    def test_debug_true_with_env_var(self):
        """Debug mode can be enabled via env var."""
        with patch.dict(os.environ, {"DEBUG": "1", "SECRET_KEY": VALID_SECRET}, clear=True):
            settings = Settings()
        
        assert settings.debug is True


class TestSecretKeyValidation:
    """Tests for SECRET_KEY validation — issue #61."""

    def test_missing_secret_key_fails_in_production(self):
        """Missing SECRET_KEY raises ValidationError when DEBUG=false."""
        with patch.dict(os.environ, {"DEBUG": "false"}, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        
        assert "not set" in str(exc_info.value).lower()

    def test_empty_secret_key_fails_in_production(self):
        """Empty SECRET_KEY raises ValidationError when DEBUG=false."""
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": ""}, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        
        assert "not set" in str(exc_info.value).lower()

    def test_whitespace_only_secret_key_fails_in_production(self):
        """Whitespace-only SECRET_KEY raises ValidationError when DEBUG=false."""
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": "   "}, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        
        assert "not set" in str(exc_info.value).lower()

    def test_short_secret_key_fails_in_production(self):
        """SECRET_KEY shorter than MIN_SECRET_LENGTH raises ValidationError."""
        short_key = "a" * (MIN_SECRET_LENGTH - 1)
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": short_key}, clear=True):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        
        assert str(MIN_SECRET_LENGTH) in str(exc_info.value)
        assert "characters" in str(exc_info.value).lower()

    def test_weak_pattern_secret_key_fails_in_production(self):
        """SECRET_KEY containing weak patterns raises ValidationError."""
        for pattern in WEAK_SECRET_PATTERNS[:3]:  # Test first 3 patterns
            # Make sure it meets length requirement but still has weak pattern
            weak_key = f"prefix-{pattern}-suffix-padding-to-meet-length-requirement"
            with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": weak_key}, clear=True):
                with pytest.raises(ValidationError) as exc_info:
                    Settings()
            
            assert "weak" in str(exc_info.value).lower() or "pattern" in str(exc_info.value).lower()

    def test_k8s_placeholder_secret_fails_in_production(self):
        """K8s placeholder secret 'k8s-secret-key-change-in-production' is rejected."""
        k8s_placeholder = "k8s-secret-key-change-in-production"
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": k8s_placeholder}, clear=True):
            with pytest.raises(ValidationError):
                Settings()

    def test_old_default_secret_fails_in_production(self):
        """Old default 'your-super-secret-key-change-in-production' is rejected."""
        old_default = "your-super-secret-key-change-in-production"
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": old_default}, clear=True):
            with pytest.raises(ValidationError):
                Settings()

    def test_valid_secret_key_accepted(self):
        """Valid strong SECRET_KEY is accepted."""
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": VALID_SECRET}, clear=True):
            settings = Settings()
        
        assert settings.secret_key == VALID_SECRET

    def test_minimum_length_secret_accepted(self):
        """SECRET_KEY at exactly MIN_SECRET_LENGTH is accepted."""
        min_length_key = "x" * MIN_SECRET_LENGTH
        with patch.dict(os.environ, {"DEBUG": "false", "SECRET_KEY": min_length_key}, clear=True):
            settings = Settings()
        
        assert settings.secret_key == min_length_key

    def test_missing_secret_warns_in_debug_mode(self):
        """Missing SECRET_KEY warns but continues when DEBUG=true."""
        with patch.dict(os.environ, {"DEBUG": "true"}, clear=True):
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                settings = Settings()
                
                # Should have at least one warning about secret key
                secret_warnings = [x for x in w if "SECRET_KEY" in str(x.message)]
                assert len(secret_warnings) >= 1
        
        # Should use insecure dev key
        assert "INSECURE" in settings.secret_key or "DEV" in settings.secret_key

    def test_short_secret_warns_in_debug_mode(self):
        """Short SECRET_KEY warns but continues when DEBUG=true."""
        short_key = "short"
        with patch.dict(os.environ, {"DEBUG": "true", "SECRET_KEY": short_key}, clear=True):
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                settings = Settings()
                
                char_warnings = [x for x in w if "characters" in str(x.message).lower()]
                assert len(char_warnings) >= 1
        
        assert settings.secret_key == short_key

    def test_weak_pattern_warns_in_debug_mode(self):
        """Weak pattern SECRET_KEY warns but continues when DEBUG=true."""
        weak_key = "your-super-secret-key-change-in-production"
        with patch.dict(os.environ, {"DEBUG": "true", "SECRET_KEY": weak_key}, clear=True):
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                settings = Settings()
                
                pattern_warnings = [x for x in w if "weak" in str(x.message).lower() or "pattern" in str(x.message).lower()]
                assert len(pattern_warnings) >= 1
        
        assert settings.secret_key == weak_key


class TestGetSettings:
    """Tests for get_settings function."""

    def test_returns_settings_instance(self):
        """get_settings returns a Settings instance."""
        get_settings.cache_clear()
        
        with patch.dict(os.environ, {"DEBUG": "true"}, clear=True):
            with warnings.catch_warnings(record=True):
                warnings.simplefilter("always")
                result = get_settings()
        
        assert isinstance(result, Settings)

    def test_settings_are_cached(self):
        """get_settings returns cached instance."""
        get_settings.cache_clear()
        
        with patch.dict(os.environ, {"DEBUG": "true"}, clear=True):
            with warnings.catch_warnings(record=True):
                warnings.simplefilter("always")
                settings1 = get_settings()
                settings2 = get_settings()
        
        assert settings1 is settings2
