"""Security utilities — RS256 JWT validation using auth service public key."""
from typing import Optional, Dict, Any

import httpx
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

# Cached public key
_public_key: Optional[str] = None


def _fetch_public_key() -> str:
    """Fetch the RS256 public key from the auth service."""
    url = f"{settings.auth_service_url}/internal/public-key"
    print(f"Fetching JWT public key from {url}...")
    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()
    data = response.json()
    print("JWT public key fetched successfully")
    return data["public_key"]


def get_public_key() -> str:
    """Get the JWT public key (cached).

    Priority:
    1. JWT_PUBLIC_KEY env var (if set)
    2. Fetch from auth service /internal/public-key
    """
    global _public_key

    if _public_key is not None:
        return _public_key

    if settings.jwt_public_key:
        _public_key = settings.jwt_public_key
        print("Using JWT public key from environment variable")
        return _public_key

    _public_key = _fetch_public_key()
    return _public_key


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate an RS256 JWT token.

    Returns the payload dict on success, or None on failure.
    """
    try:
        public_key = get_public_key()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"require_exp": True},
        )
        return payload
    except JWTError:
        return None
    except Exception:
        # Network error fetching public key, etc.
        return None
