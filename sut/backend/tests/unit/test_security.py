"""Unit tests for app.core.security module."""
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
from jose import jwt

from app.core import security
from tests.unit.conftest import create_signed_token


class TestDecodeToken:
    """Tests for decode_token function."""

    def test_decode_valid_token(self, rsa_key_pair, valid_token_payload, mock_settings):
        """decode_token returns payload for valid token."""
        token = create_signed_token(valid_token_payload, rsa_key_pair["private"])
        
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token(token)
        
        assert result is not None
        assert result["sub"] == "123"
        assert result["email"] == "test@example.com"
        assert result["iss"] == "auth-service"

    def test_decode_expired_token_returns_none(self, rsa_key_pair, expired_token_payload, mock_settings):
        """decode_token returns None for expired token."""
        token = create_signed_token(expired_token_payload, rsa_key_pair["private"])
        
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token(token)
        
        assert result is None

    def test_decode_wrong_issuer_returns_none(self, rsa_key_pair, valid_token_payload, mock_settings):
        """decode_token returns None for wrong issuer."""
        payload = {**valid_token_payload, "iss": "wrong-issuer"}
        token = create_signed_token(payload, rsa_key_pair["private"])
        
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token(token)
        
        assert result is None

    def test_decode_invalid_signature_returns_none(self, rsa_key_pair, valid_token_payload, mock_settings):
        """decode_token returns None for invalid signature."""
        # Create a different key pair for signing
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        
        wrong_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        wrong_private_pem = wrong_private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        
        token = create_signed_token(valid_token_payload, wrong_private_pem)
        
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token(token)
        
        assert result is None

    def test_decode_malformed_token_returns_none(self, mock_settings):
        """decode_token returns None for malformed token."""
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token("not.a.valid.token")
        
        assert result is None

    def test_decode_empty_token_returns_none(self, mock_settings):
        """decode_token returns None for empty token."""
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token("")
        
        assert result is None

    def test_decode_token_missing_exp_returns_none(self, rsa_key_pair, mock_settings):
        """decode_token returns None when exp claim is missing."""
        payload = {
            "sub": "123",
            "email": "test@example.com",
            "iss": "auth-service",
            # No exp claim
        }
        token = create_signed_token(payload, rsa_key_pair["private"])
        
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.decode_token(token)
        
        assert result is None


class TestGetPublicKey:
    """Tests for get_public_key function."""

    def test_uses_env_var_when_set(self, mock_settings):
        """get_public_key returns env var key when configured."""
        with patch.object(security, "get_settings", return_value=mock_settings):
            security.clear_public_key_cache()
            result = security.get_public_key()
        
        assert result == mock_settings.jwt_public_key

    def test_fetches_from_auth_service_when_no_env_var(self):
        """get_public_key fetches from auth service when env var not set."""
        settings = MagicMock()
        settings.jwt_public_key = ""  # No env var
        settings.auth_service_url = "http://test-auth:8001"
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch.object(security, "_fetch_public_key", return_value="fetched-key") as mock_fetch:
                security.clear_public_key_cache()
                result = security.get_public_key()
        
        assert result == "fetched-key"
        mock_fetch.assert_called_once()

    def test_caches_fetched_key(self):
        """get_public_key caches the fetched key."""
        settings = MagicMock()
        settings.jwt_public_key = ""
        settings.auth_service_url = "http://test-auth:8001"
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch.object(security, "_fetch_public_key", return_value="fetched-key") as mock_fetch:
                security.clear_public_key_cache()
                security.get_public_key()
                security.get_public_key()  # Second call should use cache
        
        # Should only fetch once
        mock_fetch.assert_called_once()

    def test_force_refresh_refetches_key(self):
        """get_public_key with force_refresh=True fetches fresh key."""
        settings = MagicMock()
        settings.jwt_public_key = ""
        settings.auth_service_url = "http://test-auth:8001"
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch.object(security, "_fetch_public_key", return_value="fetched-key") as mock_fetch:
                security.clear_public_key_cache()
                security.get_public_key()
                security.get_public_key(force_refresh=True)
        
        # Should fetch twice
        assert mock_fetch.call_count == 2

    def test_env_var_ignores_force_refresh(self, mock_settings):
        """get_public_key with env var ignores force_refresh."""
        with patch.object(security, "get_settings", return_value=mock_settings):
            with patch.object(security, "_fetch_public_key") as mock_fetch:
                security.clear_public_key_cache()
                result = security.get_public_key(force_refresh=True)
        
        assert result == mock_settings.jwt_public_key
        mock_fetch.assert_not_called()


class TestClearPublicKeyCache:
    """Tests for clear_public_key_cache function."""

    def test_clears_cached_key(self):
        """clear_public_key_cache resets the cache."""
        settings = MagicMock()
        settings.jwt_public_key = ""
        settings.auth_service_url = "http://test-auth:8001"
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch.object(security, "_fetch_public_key", return_value="key") as mock_fetch:
                security.clear_public_key_cache()
                security.get_public_key()
                
                # Clear and fetch again
                security.clear_public_key_cache()
                security.get_public_key()
        
        # Should fetch twice (once after clear)
        assert mock_fetch.call_count == 2


class TestFetchPublicKey:
    """Tests for _fetch_public_key function."""

    def test_fetches_from_correct_url(self):
        """_fetch_public_key calls correct auth service endpoint."""
        settings = MagicMock()
        settings.auth_service_url = "http://auth:8001"
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"public_key": "test-key"}
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch("httpx.get", return_value=mock_response) as mock_get:
                result = security._fetch_public_key()
        
        mock_get.assert_called_once_with("http://auth:8001/internal/public-key", timeout=10.0)
        assert result == "test-key"

    def test_raises_on_http_error(self):
        """_fetch_public_key raises on HTTP error."""
        import httpx
        
        settings = MagicMock()
        settings.auth_service_url = "http://auth:8001"
        
        with patch.object(security, "get_settings", return_value=settings):
            with patch("httpx.get", side_effect=httpx.HTTPStatusError(
                "Not Found", request=MagicMock(), response=MagicMock()
            )):
                with pytest.raises(httpx.HTTPStatusError):
                    security._fetch_public_key()
