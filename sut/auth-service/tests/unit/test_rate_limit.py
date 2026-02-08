"""Tests for rate limiting on auth endpoints."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.core.rate_limit import limiter, LOGIN_LIMIT, REGISTER_LIMIT, REFRESH_LIMIT


def get_mock_db():
    """Return a mock database session."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    return db


@pytest.fixture(autouse=True)
def reset_limiter():
    """Reset rate limiter before each test."""
    limiter.reset()
    yield


@pytest.fixture
def client():
    """Create a test client with mocked database."""
    app.dependency_overrides[get_db] = get_mock_db
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


class TestRateLimitConfiguration:
    """Test rate limit constants are correctly configured."""

    def test_login_limit_is_5_per_minute(self):
        """Login should be limited to 5 attempts per minute."""
        assert LOGIN_LIMIT == "5/minute"

    def test_register_limit_is_3_per_minute(self):
        """Registration should be limited to 3 per minute."""
        assert REGISTER_LIMIT == "3/minute"

    def test_refresh_limit_is_10_per_minute(self):
        """Token refresh should be limited to 10 per minute."""
        assert REFRESH_LIMIT == "10/minute"


class TestLoginRateLimiting:
    """Test rate limiting on login endpoint."""

    def test_login_within_limit_succeeds(self, client):
        """Login attempts within limit should proceed normally (may fail auth, not rate limit)."""
        # First few attempts should not be rate limited (will get 401 for bad creds)
        for i in range(3):
            response = client.post(
                "/auth/login",
                data={"username": f"test{i}@example.com", "password": "wrong"}
            )
            # Should get auth error, not rate limit error
            assert response.status_code == 401

    def test_login_exceeds_limit_returns_429(self, client):
        """Exceeding login rate limit should return 429."""
        # Make 5 requests (the limit)
        for i in range(5):
            client.post(
                "/auth/login",
                data={"username": f"test{i}@example.com", "password": "wrong"}
            )

        # 6th request should be rate limited
        response = client.post(
            "/auth/login",
            data={"username": "test@example.com", "password": "wrong"}
        )
        assert response.status_code == 429

    def test_rate_limit_response_format(self, client):
        """Rate limited responses should return proper 429 response."""
        # Exhaust the limit
        for i in range(6):
            response = client.post(
                "/auth/login",
                data={"username": f"test{i}@example.com", "password": "wrong"}
            )

        # The last response should be rate limited
        assert response.status_code == 429
        # Response should contain error detail
        assert response.json() is not None


class TestRegisterRateLimiting:
    """Test rate limiting on registration endpoint."""

    def test_register_within_limit_proceeds(self, client):
        """Registration within limit should proceed (may fail for other reasons)."""
        for i in range(2):
            response = client.post(
                "/auth/register",
                json={
                    "email": f"newuser{i}@example.com",
                    "password": "SecurePass123!",
                    "full_name": f"User {i}"
                }
            )
            # Should not be rate limited
            assert response.status_code != 429

    def test_register_exceeds_limit_returns_429(self, client):
        """Exceeding registration rate limit should return 429."""
        # Make 3 requests (the limit)
        for i in range(3):
            client.post(
                "/auth/register",
                json={
                    "email": f"newuser{i}@example.com",
                    "password": "SecurePass123!",
                    "full_name": f"User {i}"
                }
            )

        # 4th request should be rate limited
        response = client.post(
            "/auth/register",
            json={
                "email": "another@example.com",
                "password": "SecurePass123!",
                "full_name": "Another User"
            }
        )
        assert response.status_code == 429


class TestRefreshRateLimiting:
    """Test rate limiting on token refresh endpoint."""

    def test_refresh_exceeds_limit_returns_429(self, client):
        """Exceeding refresh rate limit should return 429."""
        # Make 10 requests (the limit)
        for i in range(10):
            client.post(
                "/auth/refresh",
                json={"refresh_token": f"fake_token_{i}"}
            )

        # 11th request should be rate limited
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": "another_fake_token"}
        )
        assert response.status_code == 429


class TestRateLimitIsolation:
    """Test that rate limits are isolated per endpoint and IP."""

    def test_different_endpoints_have_separate_limits(self, client):
        """Rate limits should be tracked separately for each endpoint."""
        # Exhaust login limit
        for i in range(5):
            client.post(
                "/auth/login",
                data={"username": f"test{i}@example.com", "password": "wrong"}
            )

        # Login should now be rate limited
        login_response = client.post(
            "/auth/login",
            data={"username": "test@example.com", "password": "wrong"}
        )
        assert login_response.status_code == 429

        # But register should still work (different endpoint, different limit)
        register_response = client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "password": "SecurePass123!",
                "full_name": "New User"
            }
        )
        # Should not be 429 - different endpoint has its own limit
        assert register_response.status_code != 429
