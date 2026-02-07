"""Integration tests for JWT authentication flow."""
import pytest
from fastapi import status

from tests.integration.conftest import create_test_token


class TestJWTAuthentication:
    """Tests for JWT token validation in API requests."""

    def test_missing_token_returns_401(self, client):
        """Request without token returns 401."""
        response = client.get("/api/cart")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.json()["detail"] == "Not authenticated"

    def test_invalid_token_returns_401(self, client, mock_jwt_settings):
        """Request with invalid token returns 401."""
        response = client.get(
            "/api/cart",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Could not validate credentials" in response.json()["detail"]

    def test_expired_token_returns_401(self, client, expired_auth_headers):
        """Request with expired token returns 401."""
        response = client.get("/api/cart", headers=expired_auth_headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Could not validate credentials" in response.json()["detail"]

    def test_valid_token_succeeds(self, client, auth_headers):
        """Request with valid token succeeds."""
        response = client.get("/api/cart", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK

    def test_wrong_algorithm_token_returns_401(self, client, mock_jwt_settings, rsa_key_pair):
        """Token signed with wrong algorithm is rejected."""
        from jose import jwt
        
        # Create HS256 token instead of RS256
        payload = {
            "sub": "123",
            "email": "test@example.com",
            "name": "Test",
            "admin": False,
            "iss": "auth-service",
            "exp": 9999999999,
            "iat": 1000000000,
        }
        # This will fail validation since we expect RS256
        token = jwt.encode(payload, "secret", algorithm="HS256")
        
        response = client.get(
            "/api/cart",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_wrong_issuer_token_returns_401(self, client, mock_jwt_settings, rsa_key_pair):
        """Token with wrong issuer is rejected."""
        token = create_test_token(rsa_key_pair)
        # Manually create token with wrong issuer
        from datetime import datetime, timedelta, timezone
        from jose import jwt
        
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "123",
            "email": "test@example.com",
            "name": "Test",
            "admin": False,
            "iss": "wrong-issuer",  # Wrong issuer
            "exp": int((now + timedelta(hours=1)).timestamp()),
            "iat": int(now.timestamp()),
        }
        token = jwt.encode(payload, rsa_key_pair["private"], algorithm="RS256")
        
        response = client.get(
            "/api/cart",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestUserAutoCreation:
    """Tests for automatic user creation from JWT claims."""

    def test_user_created_on_first_request(self, client, auth_headers, db_session):
        """User record is created on first authenticated request."""
        from app.models.user import User
        
        # No user exists yet
        assert db_session.query(User).filter(User.email == "test@example.com").first() is None
        
        # Make authenticated request
        response = client.get("/api/cart", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        
        # User should now exist
        user = db_session.query(User).filter(User.email == "test@example.com").first()
        assert user is not None
        assert user.full_name == "Test User"
        assert user.auth_service_id == 123
        assert user.is_admin is False

    def test_admin_claim_reflected_in_user(self, client, admin_auth_headers, db_session):
        """Admin claim from JWT is reflected in user record."""
        from app.models.user import User
        
        # Make authenticated request as admin
        response = client.get("/api/cart", headers=admin_auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Admin user should be created
        user = db_session.query(User).filter(User.email == "admin@example.com").first()
        assert user is not None
        assert user.is_admin is True


class TestAdminAuthorization:
    """Tests for admin-only endpoint authorization."""

    def test_regular_user_cannot_access_admin_endpoints(self, client, auth_headers, sample_category):
        """Regular user cannot access admin endpoints."""
        response = client.post(
            "/api/products",
            json={"name": "New Product", "price": 10.0, "stock": 5},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in response.json()["detail"]

    def test_admin_can_access_admin_endpoints(self, client, admin_auth_headers, sample_category):
        """Admin user can access admin endpoints."""
        response = client.post(
            "/api/products",
            json={"name": "New Product", "price": 10.0, "stock": 5},
            headers=admin_auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
