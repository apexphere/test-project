"""Shared fixtures for auth-service tests."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# Add auth-service app to path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def rsa_key_pair():
    """Generate a fresh RSA key pair for testing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    
    return {"private": private_pem, "public": public_pem}


@pytest.fixture
def mock_settings(rsa_key_pair):
    """Mock settings with RSA keys."""
    settings = MagicMock()
    settings.jwt_private_key = rsa_key_pair["private"]
    settings.jwt_public_key = rsa_key_pair["public"]
    settings.jwt_algorithm = "RS256"
    settings.access_token_expire_minutes = 60
    settings.refresh_token_expire_days = 7
    return settings


@pytest.fixture
def valid_token_payload():
    """Standard valid JWT payload."""
    now = datetime.now(timezone.utc)
    return {
        "sub": "123",
        "email": "test@example.com",
        "name": "Test User",
        "admin": False,
        "iss": "auth-service",
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
    }


@pytest.fixture
def expired_token_payload(valid_token_payload):
    """Expired JWT payload."""
    now = datetime.now(timezone.utc)
    return {
        **valid_token_payload,
        "exp": int((now - timedelta(hours=1)).timestamp()),
    }


@pytest.fixture
def mock_db_session():
    """Mock SQLAlchemy database session."""
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    return session


@pytest.fixture
def mock_user():
    """Mock User ORM object."""
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.hashed_password = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4gQP.a5TdKnJzFHi"  # "password123"
    user.is_active = True
    user.is_admin = False
    return user
