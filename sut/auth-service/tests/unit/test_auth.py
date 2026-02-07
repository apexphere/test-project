"""Unit tests for auth route logic."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.security import hash_password


class TestRegisterLogic:
    """Tests for registration logic."""

    def test_register_creates_user(self, mock_db_session):
        """Registration creates a new user with hashed password."""
        from app.api.routes.auth import register
        from app.schemas import UserCreate
        
        user_data = UserCreate(
            email="new@example.com",
            password="securepassword123",
            full_name="New User",
        )
        
        # Mock User class and db behavior
        mock_user_instance = MagicMock()
        mock_user_instance.id = 1
        mock_user_instance.email = user_data.email
        mock_user_instance.full_name = user_data.full_name
        mock_user_instance.is_active = True
        mock_user_instance.is_admin = False
        mock_user_instance.created_at = datetime.now(timezone.utc)
        
        with patch("app.api.routes.auth.User") as MockUser:
            MockUser.return_value = mock_user_instance
            mock_db_session.query.return_value.filter.return_value.first.return_value = None
            
            result = register(user_data, mock_db_session)
        
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        assert result.email == user_data.email

    def test_register_duplicate_email_raises_409(self, mock_db_session, mock_user):
        """Registration with existing email raises HTTPException 409."""
        from app.api.routes.auth import register
        from app.schemas import UserCreate
        
        user_data = UserCreate(
            email="existing@example.com",
            password="password123",
            full_name="Test",
        )
        
        # Mock existing user found
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with pytest.raises(HTTPException) as exc_info:
            register(user_data, mock_db_session)
        
        assert exc_info.value.status_code == 409
        assert "already registered" in exc_info.value.detail


class TestLoginLogic:
    """Tests for login logic."""

    def test_login_success(self, mock_db_session, mock_user, mock_settings, rsa_key_pair):
        """Login with valid credentials returns tokens."""
        from app.api.routes.auth import login
        from fastapi.security import OAuth2PasswordRequestForm
        
        # Set up user with known password
        password = "correctpassword"
        mock_user.hashed_password = hash_password(password)
        mock_user.is_active = True
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        form = MagicMock(spec=OAuth2PasswordRequestForm)
        form.username = mock_user.email
        form.password = password
        
        with patch("app.api.routes.auth.get_settings", return_value=mock_settings):
            with patch("app.core.jwt._private_key", rsa_key_pair["private"]):
                with patch("app.core.jwt._public_key", rsa_key_pair["public"]):
                    with patch("app.core.jwt.get_settings", return_value=mock_settings):
                        result = login(form, mock_db_session)
        
        assert result.access_token is not None
        assert result.token_type == "bearer"

    def test_login_wrong_password_raises_401(self, mock_db_session, mock_user):
        """Login with wrong password raises HTTPException 401."""
        from app.api.routes.auth import login
        from fastapi.security import OAuth2PasswordRequestForm
        
        mock_user.hashed_password = hash_password("correctpassword")
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        form = MagicMock(spec=OAuth2PasswordRequestForm)
        form.username = mock_user.email
        form.password = "wrongpassword"
        
        with pytest.raises(HTTPException) as exc_info:
            login(form, mock_db_session)
        
        assert exc_info.value.status_code == 401

    def test_login_nonexistent_user_raises_401(self, mock_db_session):
        """Login with non-existent email raises HTTPException 401."""
        from app.api.routes.auth import login
        from fastapi.security import OAuth2PasswordRequestForm
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        form = MagicMock(spec=OAuth2PasswordRequestForm)
        form.username = "noexist@example.com"
        form.password = "anypassword"
        
        with pytest.raises(HTTPException) as exc_info:
            login(form, mock_db_session)
        
        assert exc_info.value.status_code == 401

    def test_login_inactive_user_raises_401(self, mock_db_session, mock_user):
        """Login with inactive user raises HTTPException 401."""
        from app.api.routes.auth import login
        from fastapi.security import OAuth2PasswordRequestForm
        
        password = "correctpassword"
        mock_user.hashed_password = hash_password(password)
        mock_user.is_active = False
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        form = MagicMock(spec=OAuth2PasswordRequestForm)
        form.username = mock_user.email
        form.password = password
        
        with pytest.raises(HTTPException) as exc_info:
            login(form, mock_db_session)
        
        assert exc_info.value.status_code == 401
        assert "deactivated" in exc_info.value.detail


class TestGetCurrentUser:
    """Tests for get_current_user dependency."""

    def test_valid_token_returns_user(self, mock_db_session, mock_user, mock_settings, rsa_key_pair, valid_token_payload):
        """Valid token returns associated user."""
        from app.api.routes.auth import get_current_user
        from jose import jwt
        
        token = jwt.encode(valid_token_payload, rsa_key_pair["private"], algorithm="RS256")
        mock_user.id = int(valid_token_payload["sub"])
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with patch("app.core.jwt._private_key", rsa_key_pair["private"]):
            with patch("app.core.jwt._public_key", rsa_key_pair["public"]):
                with patch("app.core.jwt.get_settings", return_value=mock_settings):
                    result = get_current_user(token, mock_db_session)
        
        assert result == mock_user

    def test_invalid_token_raises_401(self, mock_db_session, mock_settings, rsa_key_pair):
        """Invalid token raises HTTPException 401."""
        from app.api.routes.auth import get_current_user
        
        with patch("app.core.jwt._private_key", rsa_key_pair["private"]):
            with patch("app.core.jwt._public_key", rsa_key_pair["public"]):
                with patch("app.core.jwt.get_settings", return_value=mock_settings):
                    with pytest.raises(HTTPException) as exc_info:
                        get_current_user("invalid.token.here", mock_db_session)
        
        assert exc_info.value.status_code == 401

    def test_user_not_found_raises_401(self, mock_db_session, mock_settings, rsa_key_pair, valid_token_payload):
        """Valid token but user not in DB raises HTTPException 401."""
        from app.api.routes.auth import get_current_user
        from jose import jwt
        
        token = jwt.encode(valid_token_payload, rsa_key_pair["private"], algorithm="RS256")
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        with patch("app.core.jwt._private_key", rsa_key_pair["private"]):
            with patch("app.core.jwt._public_key", rsa_key_pair["public"]):
                with patch("app.core.jwt.get_settings", return_value=mock_settings):
                    with pytest.raises(HTTPException) as exc_info:
                        get_current_user(token, mock_db_session)
        
        assert exc_info.value.status_code == 401

    def test_inactive_user_raises_401(self, mock_db_session, mock_user, mock_settings, rsa_key_pair, valid_token_payload):
        """Token for inactive user raises HTTPException 401."""
        from app.api.routes.auth import get_current_user
        from jose import jwt
        
        token = jwt.encode(valid_token_payload, rsa_key_pair["private"], algorithm="RS256")
        mock_user.id = int(valid_token_payload["sub"])
        mock_user.is_active = False
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_user
        
        with patch("app.core.jwt._private_key", rsa_key_pair["private"]):
            with patch("app.core.jwt._public_key", rsa_key_pair["public"]):
                with patch("app.core.jwt.get_settings", return_value=mock_settings):
                    with pytest.raises(HTTPException) as exc_info:
                        get_current_user(token, mock_db_session)
        
        assert exc_info.value.status_code == 401
