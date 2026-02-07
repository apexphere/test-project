"""Unit tests for app.core.jwt module."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
from jose import jwt, JWTError

from app.core import jwt as jwt_module


def create_signed_token(payload: dict, private_key: str) -> str:
    """Create an RS256 signed JWT token."""
    return jwt.encode(payload, private_key, algorithm="RS256")


class TestCreateAccessToken:
    """Tests for create_access_token function."""

    def test_creates_valid_token(self, rsa_key_pair, mock_settings):
        """create_access_token creates a decodable token with correct claims."""
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    token = jwt_module.create_access_token(
                        user_id=123,
                        email="test@example.com",
                        is_admin=False,
                        full_name="Test User",
                    )
        
        # Decode and verify claims
        claims = jwt.decode(token, rsa_key_pair["public"], algorithms=["RS256"])
        assert claims["sub"] == "123"
        assert claims["email"] == "test@example.com"
        assert claims["name"] == "Test User"
        assert claims["admin"] is False
        assert claims["iss"] == "auth-service"

    def test_creates_admin_token(self, rsa_key_pair, mock_settings):
        """create_access_token sets admin claim correctly."""
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    token = jwt_module.create_access_token(
                        user_id=999,
                        email="admin@example.com",
                        is_admin=True,
                    )
        
        claims = jwt.decode(token, rsa_key_pair["public"], algorithms=["RS256"])
        assert claims["admin"] is True

    def test_custom_expiration(self, rsa_key_pair, mock_settings):
        """create_access_token respects custom expiration."""
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    custom_delta = timedelta(minutes=5)
                    token = jwt_module.create_access_token(
                        user_id=1,
                        email="test@example.com",
                        expires_delta=custom_delta,
                    )
        
        claims = jwt.decode(token, rsa_key_pair["public"], algorithms=["RS256"])
        exp = datetime.fromtimestamp(claims["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
        
        # Should be close to 5 minutes
        diff = (exp - iat).total_seconds()
        assert 299 <= diff <= 301  # 5 minutes ± 1 second


class TestCreateRefreshToken:
    """Tests for create_refresh_token function."""

    def test_creates_random_token(self):
        """create_refresh_token returns a random string."""
        token1 = jwt_module.create_refresh_token()
        token2 = jwt_module.create_refresh_token()
        
        assert token1 != token2
        assert len(token1) > 20  # url-safe base64, should be ~43 chars

    def test_token_is_url_safe(self):
        """create_refresh_token returns url-safe token."""
        token = jwt_module.create_refresh_token()
        
        # URL-safe base64 only contains these characters
        valid_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        assert all(c in valid_chars for c in token)


class TestHashRefreshToken:
    """Tests for hash_refresh_token function."""

    def test_hashes_token(self):
        """hash_refresh_token returns SHA256 hash."""
        token = "test_token"
        hashed = jwt_module.hash_refresh_token(token)
        
        assert hashed != token
        assert len(hashed) == 64  # SHA256 hex digest

    def test_consistent_hash(self):
        """hash_refresh_token returns same hash for same input."""
        token = "test_token"
        hash1 = jwt_module.hash_refresh_token(token)
        hash2 = jwt_module.hash_refresh_token(token)
        
        assert hash1 == hash2

    def test_different_tokens_different_hashes(self):
        """hash_refresh_token returns different hash for different inputs."""
        hash1 = jwt_module.hash_refresh_token("token1")
        hash2 = jwt_module.hash_refresh_token("token2")
        
        assert hash1 != hash2


class TestDecodeToken:
    """Tests for decode_token function."""

    def test_decode_valid_token(self, rsa_key_pair, valid_token_payload, mock_settings):
        """decode_token returns payload for valid token."""
        token = create_signed_token(valid_token_payload, rsa_key_pair["private"])
        
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    result = jwt_module.decode_token(token)
        
        assert result["sub"] == "123"
        assert result["email"] == "test@example.com"

    def test_decode_expired_token_raises(self, rsa_key_pair, expired_token_payload, mock_settings):
        """decode_token raises JWTError for expired token."""
        token = create_signed_token(expired_token_payload, rsa_key_pair["private"])
        
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    with pytest.raises(JWTError):
                        jwt_module.decode_token(token)

    def test_decode_invalid_signature_raises(self, rsa_key_pair, valid_token_payload, mock_settings):
        """decode_token raises JWTError for invalid signature."""
        from cryptography.hazmat.primitives.asymmetric import rsa as rsa_gen
        from cryptography.hazmat.primitives import serialization
        
        # Sign with different key
        wrong_key = rsa_gen.generate_private_key(public_exponent=65537, key_size=2048)
        wrong_private_pem = wrong_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        
        token = create_signed_token(valid_token_payload, wrong_private_pem)
        
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    with pytest.raises(JWTError):
                        jwt_module.decode_token(token)

    def test_decode_malformed_token_raises(self, rsa_key_pair, mock_settings):
        """decode_token raises JWTError for malformed token."""
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    with pytest.raises(JWTError):
                        jwt_module.decode_token("not.a.valid.token")


class TestValidateToken:
    """Tests for validate_token function."""

    def test_validate_valid_token(self, rsa_key_pair, valid_token_payload, mock_settings):
        """validate_token returns (True, claims, None) for valid token."""
        token = create_signed_token(valid_token_payload, rsa_key_pair["private"])
        
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    valid, claims, error = jwt_module.validate_token(token)
        
        assert valid is True
        assert claims is not None
        assert claims["sub"] == "123"
        assert error is None

    def test_validate_invalid_token(self, rsa_key_pair, mock_settings):
        """validate_token returns (False, None, error) for invalid token."""
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    valid, claims, error = jwt_module.validate_token("invalid")
        
        assert valid is False
        assert claims is None
        assert error is not None

    def test_validate_expired_token(self, rsa_key_pair, expired_token_payload, mock_settings):
        """validate_token returns (False, None, error) for expired token."""
        token = create_signed_token(expired_token_payload, rsa_key_pair["private"])
        
        with patch.object(jwt_module, "get_settings", return_value=mock_settings):
            with patch.object(jwt_module, "_private_key", rsa_key_pair["private"]):
                with patch.object(jwt_module, "_public_key", rsa_key_pair["public"]):
                    valid, claims, error = jwt_module.validate_token(token)
        
        assert valid is False
        assert claims is None
        assert "expired" in error.lower() or "exp" in error.lower()
