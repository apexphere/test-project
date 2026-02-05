"""Security utilities — RS256 JWT validation using auth service public key."""
import logging
import time
from typing import Optional, Dict, Any

import httpx
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Cached public key with TTL for rotation support
_public_key: Optional[str] = None
_public_key_fetched_at: float = 0
PUBLIC_KEY_TTL_SECONDS: int = 86400  # 24 hours


def _fetch_public_key() -> str:
    """Fetch the RS256 public key from the auth service."""
    url = f"{settings.auth_service_url}/internal/public-key"
    logger.info("Fetching JWT public key from %s", url)
    response = httpx.get(url, timeout=10.0)
    response.raise_for_status()
    data = response.json()
    logger.info("JWT public key fetched successfully")
    return data["public_key"]


def get_public_key(force_refresh: bool = False) -> str:
    """Get the JWT public key (cached with TTL).

    Priority:
    1. JWT_PUBLIC_KEY env var (if set) — never expires
    2. Fetch from auth service /internal/public-key (cached for 24h)
    
    Args:
        force_refresh: Force a fresh fetch from auth service (ignored if env var is set)
    """
    global _public_key, _public_key_fetched_at

    # Static key from env var — always use, never refresh
    if settings.jwt_public_key:
        if _public_key != settings.jwt_public_key:
            _public_key = settings.jwt_public_key
            logger.info("Using JWT public key from environment variable")
        return _public_key

    # Check if we need to refresh (TTL expired or forced)
    now = time.time()
    key_expired = (now - _public_key_fetched_at) > PUBLIC_KEY_TTL_SECONDS
    
    if _public_key is None or force_refresh or key_expired:
        _public_key = _fetch_public_key()
        _public_key_fetched_at = now

    return _public_key


def clear_public_key_cache() -> None:
    """Clear the cached public key (for testing or manual rotation)."""
    global _public_key, _public_key_fetched_at
    _public_key = None
    _public_key_fetched_at = 0
    logger.info("JWT public key cache cleared")


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate an RS256 JWT token.

    Validates:
    - RS256 signature using auth service public key
    - Token expiration (exp claim required)
    - Issuer is "auth-service" (prevents accepting tokens from other issuers)

    Returns the payload dict on success, or None on failure.
    """
    try:
        public_key = get_public_key()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"require_exp": True},
            issuer="auth-service",
        )
        return payload
    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        return None
    except httpx.HTTPError as e:
        # Network error fetching public key
        logger.error("Failed to fetch JWT public key: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error decoding token: %s", e)
        return None
