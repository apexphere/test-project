"""Unit tests for app.core.security module."""
import pytest

from app.core.security import hash_password, verify_password


class TestHashPassword:
    """Tests for hash_password function."""

    def test_returns_hash(self):
        """hash_password returns a bcrypt hash."""
        password = "mypassword123"
        hashed = hash_password(password)
        
        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt identifier

    def test_different_hashes_for_same_password(self):
        """hash_password returns different hash each time (salt)."""
        password = "mypassword123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Bcrypt uses random salt, so hashes should differ
        assert hash1 != hash2

    def test_hashes_empty_password(self):
        """hash_password handles empty password."""
        hashed = hash_password("")
        
        assert hashed.startswith("$2b$")

    def test_hashes_unicode_password(self):
        """hash_password handles unicode characters."""
        password = "пароль123🔐"
        hashed = hash_password(password)
        
        assert hashed.startswith("$2b$")


class TestVerifyPassword:
    """Tests for verify_password function."""

    def test_correct_password_returns_true(self):
        """verify_password returns True for correct password."""
        password = "mypassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True

    def test_wrong_password_returns_false(self):
        """verify_password returns False for wrong password."""
        hashed = hash_password("correctpassword")
        
        assert verify_password("wrongpassword", hashed) is False

    def test_empty_password_verification(self):
        """verify_password works with empty password."""
        hashed = hash_password("")
        
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False

    def test_unicode_password_verification(self):
        """verify_password works with unicode password."""
        password = "пароль123🔐"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
        assert verify_password("wrong", hashed) is False

    def test_case_sensitive(self):
        """verify_password is case sensitive."""
        hashed = hash_password("Password")
        
        assert verify_password("Password", hashed) is True
        assert verify_password("password", hashed) is False
        assert verify_password("PASSWORD", hashed) is False
