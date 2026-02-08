"""Rate limiting configuration for auth endpoints."""
from slowapi import Limiter
from starlette.requests import Request


def get_real_client_ip(request: Request) -> str:
    """Extract real client IP from X-Forwarded-For header.

    Behind k8s ingress/load balancers, request.client.host returns the
    ingress pod IP, not the actual client. Nginx ingress sets X-Forwarded-For
    with the real client IP as the first entry.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For format: "client, proxy1, proxy2, ..."
        return forwarded.split(",")[0].strip()
    return request.client.host or "unknown"


# Create limiter instance using real client IP as key
limiter = Limiter(key_func=get_real_client_ip)

# Rate limit constants for auth endpoints
# These are intentionally strict to prevent brute-force attacks
LOGIN_LIMIT = "5/minute"           # 5 login attempts per minute per IP
REGISTER_LIMIT = "3/minute"        # 3 registrations per minute per IP
REFRESH_LIMIT = "10/minute"        # 10 token refreshes per minute per IP
PASSWORD_RESET_LIMIT = "3/minute"  # 3 password reset requests per minute per IP (future use)
