"""
Auth Service API Routes

Public endpoints (exposed to frontend):
- POST /auth/register - Create new user
- POST /auth/login - Authenticate and get JWT
- POST /auth/refresh - Refresh access token
- GET  /auth/me - Get current user info

Internal endpoints (service-to-service):
- POST /internal/validate - Validate JWT token
- GET  /internal/users/{id} - Get user by ID
"""
