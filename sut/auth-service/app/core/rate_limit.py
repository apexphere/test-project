"""Rate limiting configuration for auth endpoints."""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Create limiter instance using client IP as key
limiter = Limiter(key_func=get_remote_address)

# Rate limit constants for auth endpoints
# These are intentionally strict to prevent brute-force attacks
LOGIN_LIMIT = "5/minute"           # 5 login attempts per minute per IP
REGISTER_LIMIT = "3/minute"        # 3 registrations per minute per IP
REFRESH_LIMIT = "10/minute"        # 10 token refreshes per minute per IP
PASSWORD_RESET_LIMIT = "3/minute"  # 3 password reset requests per minute per IP (future use)
