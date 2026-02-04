"""JWT token utilities for Auth Service."""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import hashlib
import secrets

from jose import jwt, JWTError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

from app.config import get_settings

settings = get_settings()

# Generate RSA keys if not provided
_private_key: Optional[str] = None
_public_key: Optional[str] = None


def _generate_rsa_keys() -> tuple[str, str]:
    """Generate RSA key pair for JWT signing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem


def _get_keys() -> tuple[str, str]:
    """Get JWT signing keys (generate if needed)."""
    global _private_key, _public_key
    
    if settings.jwt_private_key and settings.jwt_public_key:
        return settings.jwt_private_key, settings.jwt_public_key
    
    if _private_key is None or _public_key is None:
        print("Generating RSA keys for JWT signing...")
        _private_key, _public_key = _generate_rsa_keys()
        print("RSA keys generated successfully")
    
    return _private_key, _public_key


def get_public_key() -> str:
    """Get the public key for distribution to other services."""
    _, public_key = _get_keys()
    return public_key


def create_access_token(
    user_id: int,
    email: str,
    is_admin: bool = False,
    full_name: Optional[str] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a signed JWT access token."""
    private_key, _ = _get_keys()
    
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    
    now = datetime.utcnow()
    expire = now + expires_delta
    
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": full_name,
        "admin": is_admin,
        "iat": now,
        "exp": expire,
        "iss": "auth-service",
    }
    
    return jwt.encode(payload, private_key, algorithm=settings.jwt_algorithm)


def create_refresh_token() -> str:
    """Create a random refresh token."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token.
    
    Raises:
        JWTError: If token is invalid or expired
    """
    _, public_key = _get_keys()
    
    return jwt.decode(
        token,
        public_key,
        algorithms=[settings.jwt_algorithm],
        options={"require_exp": True, "require_iat": True}
    )


def validate_token(token: str) -> tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Validate a token and return (valid, claims, error)."""
    try:
        claims = decode_token(token)
        return True, claims, None
    except JWTError as e:
        return False, None, str(e)
