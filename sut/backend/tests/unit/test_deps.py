"""Unit tests for app.core.deps module."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.deps import (
    UserContext,
    get_user_context,
    _find_or_create_user,
    _sync_user_claims,
    get_current_active_user,
)


class TestUserContext:
    """Tests for UserContext model."""

    def test_create_minimal_user_context(self):
        """UserContext can be created with minimal fields."""
        ctx = UserContext(auth_service_id=1, email="test@example.com")
        
        assert ctx.auth_service_id == 1
        assert ctx.email == "test@example.com"
        assert ctx.full_name is None
        assert ctx.is_admin is False

    def test_create_full_user_context(self):
        """UserContext can be created with all fields."""
        ctx = UserContext(
            auth_service_id=42,
            email="admin@example.com",
            full_name="Admin User",
            is_admin=True,
        )
        
        assert ctx.auth_service_id == 42
        assert ctx.email == "admin@example.com"
        assert ctx.full_name == "Admin User"
        assert ctx.is_admin is True


class TestGetUserContext:
    """Tests for get_user_context dependency."""

    @pytest.mark.asyncio
    async def test_returns_user_context_from_valid_token(self):
        """get_user_context returns UserContext for valid token."""
        mock_payload = {
            "sub": "123",
            "email": "user@example.com",
            "name": "Test User",
            "admin": False,
        }
        
        with patch("app.core.deps.decode_token", return_value=mock_payload):
            result = await get_user_context(token="valid-token")
        
        assert isinstance(result, UserContext)
        assert result.auth_service_id == 123
        assert result.email == "user@example.com"
        assert result.full_name == "Test User"
        assert result.is_admin is False

    @pytest.mark.asyncio
    async def test_returns_admin_context(self):
        """get_user_context correctly sets admin flag."""
        mock_payload = {
            "sub": "999",
            "email": "admin@example.com",
            "name": "Admin",
            "admin": True,
        }
        
        with patch("app.core.deps.decode_token", return_value=mock_payload):
            result = await get_user_context(token="admin-token")
        
        assert result.is_admin is True

    @pytest.mark.asyncio
    async def test_raises_401_for_invalid_token(self):
        """get_user_context raises 401 for invalid token."""
        with patch("app.core.deps.decode_token", return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await get_user_context(token="invalid-token")
        
        assert exc_info.value.status_code == 401
        assert "Could not validate credentials" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_raises_401_for_missing_sub_claim(self):
        """get_user_context raises 401 when sub is missing."""
        mock_payload = {"email": "user@example.com"}
        
        with patch("app.core.deps.decode_token", return_value=mock_payload):
            with pytest.raises(HTTPException) as exc_info:
                await get_user_context(token="token")
        
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_raises_401_for_missing_email_claim(self):
        """get_user_context raises 401 when email is missing."""
        mock_payload = {"sub": "123"}
        
        with patch("app.core.deps.decode_token", return_value=mock_payload):
            with pytest.raises(HTTPException) as exc_info:
                await get_user_context(token="token")
        
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_handles_missing_optional_claims(self):
        """get_user_context handles missing name and admin claims."""
        mock_payload = {"sub": "123", "email": "user@example.com"}
        
        with patch("app.core.deps.decode_token", return_value=mock_payload):
            result = await get_user_context(token="token")
        
        assert result.full_name is None
        assert result.is_admin is False


class TestFindOrCreateUser:
    """Tests for _find_or_create_user function."""

    def test_returns_existing_user(self, mock_db_session, mock_user):
        """_find_or_create_user returns existing user when found."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        ctx = UserContext(auth_service_id=123, email="test@example.com")
        
        result = _find_or_create_user(mock_db_session, ctx)
        
        assert result == mock_user
        mock_db_session.add.assert_not_called()

    def test_creates_new_user_when_not_found(self, mock_db_session):
        """_find_or_create_user creates user when not found."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        ctx = UserContext(
            auth_service_id=456,
            email="new@example.com",
            full_name="New User",
            is_admin=False,
        )
        
        result = _find_or_create_user(mock_db_session, ctx)
        
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    def test_handles_race_condition_on_create(self, mock_db_session, mock_user):
        """_find_or_create_user handles race condition gracefully."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None, mock_user]
        mock_db_session.commit.side_effect = IntegrityError("duplicate", None, None)
        
        ctx = UserContext(auth_service_id=123, email="test@example.com")
        
        result = _find_or_create_user(mock_db_session, ctx)
        
        assert result == mock_user
        mock_db_session.rollback.assert_called_once()

    def test_raises_500_when_user_not_found_after_race(self, mock_db_session):
        """_find_or_create_user raises 500 if user missing after IntegrityError."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        mock_db_session.commit.side_effect = IntegrityError("duplicate", None, None)
        
        ctx = UserContext(auth_service_id=123, email="test@example.com")
        
        with pytest.raises(HTTPException) as exc_info:
            _find_or_create_user(mock_db_session, ctx)
        
        assert exc_info.value.status_code == 500


class TestSyncUserClaims:
    """Tests for _sync_user_claims function."""

    def test_updates_changed_claims(self, mock_db_session, mock_user):
        """_sync_user_claims updates user when claims differ."""
        ctx = UserContext(
            auth_service_id=123,
            email="test@example.com",
            full_name="Updated Name",
            is_admin=True,
        )
        
        _sync_user_claims(mock_db_session, mock_user, ctx)
        
        assert mock_user.full_name == "Updated Name"
        assert mock_user.is_admin is True
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    def test_no_update_when_claims_match(self, mock_db_session, mock_user):
        """_sync_user_claims does not update when claims match."""
        ctx = UserContext(
            auth_service_id=123,
            email="test@example.com",
            full_name="Test User",
            is_admin=False,
        )
        
        _sync_user_claims(mock_db_session, mock_user, ctx)
        
        mock_db_session.commit.assert_not_called()

    def test_updates_auth_service_id(self, mock_db_session, mock_user):
        """_sync_user_claims updates auth_service_id when different."""
        mock_user.auth_service_id = 100
        ctx = UserContext(
            auth_service_id=200,
            email="test@example.com",
            full_name="Test User",
            is_admin=False,
        )
        
        _sync_user_claims(mock_db_session, mock_user, ctx)
        
        assert mock_user.auth_service_id == 200
        mock_db_session.commit.assert_called_once()


class TestGetCurrentActiveUser:
    """Tests for get_current_active_user dependency."""

    @pytest.mark.asyncio
    async def test_returns_active_user(self, mock_user):
        """get_current_active_user returns user if active."""
        mock_user.is_active = True
        
        result = await get_current_active_user(current_user=mock_user)
        
        assert result == mock_user

    @pytest.mark.asyncio
    async def test_raises_400_for_inactive_user(self, mock_user):
        """get_current_active_user raises 400 for inactive user."""
        mock_user.is_active = False
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_active_user(current_user=mock_user)
        
        assert exc_info.value.status_code == 400
        assert "Inactive user" in exc_info.value.detail
