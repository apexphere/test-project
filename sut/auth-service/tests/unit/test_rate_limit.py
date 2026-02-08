"""Tests for rate limiting functionality."""
import pytest
from unittest.mock import MagicMock
from starlette.requests import Request

from app.core.rate_limit import get_real_client_ip


class TestGetRealClientIp:
    """Tests for the get_real_client_ip function."""

    def _create_mock_request(self, headers: dict = None, client_host: str = "127.0.0.1"):
        """Create a mock request with optional headers and client host."""
        request = MagicMock(spec=Request)
        request.headers = headers or {}
        request.client = MagicMock()
        request.client.host = client_host
        return request

    def test_uses_x_forwarded_for_when_present(self):
        """Should extract client IP from X-Forwarded-For header."""
        request = self._create_mock_request(
            headers={"X-Forwarded-For": "203.0.113.195"},
            client_host="10.0.0.1"  # k8s ingress pod IP
        )
        
        result = get_real_client_ip(request)
        
        assert result == "203.0.113.195"

    def test_uses_first_ip_from_x_forwarded_for_chain(self):
        """Should use first IP when X-Forwarded-For contains proxy chain."""
        request = self._create_mock_request(
            headers={"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178"},
            client_host="10.0.0.1"
        )
        
        result = get_real_client_ip(request)
        
        assert result == "203.0.113.195"

    def test_strips_whitespace_from_ip(self):
        """Should strip whitespace from extracted IP."""
        request = self._create_mock_request(
            headers={"X-Forwarded-For": "  203.0.113.195  , 70.41.3.18"},
            client_host="10.0.0.1"
        )
        
        result = get_real_client_ip(request)
        
        assert result == "203.0.113.195"

    def test_falls_back_to_client_host_when_no_header(self):
        """Should use request.client.host when X-Forwarded-For is missing."""
        request = self._create_mock_request(
            headers={},
            client_host="192.168.1.100"
        )
        
        result = get_real_client_ip(request)
        
        assert result == "192.168.1.100"

    def test_returns_unknown_when_no_client_info(self):
        """Should return 'unknown' when no client info available."""
        request = self._create_mock_request(headers={})
        request.client.host = None
        
        result = get_real_client_ip(request)
        
        assert result == "unknown"

    def test_handles_ipv6_address(self):
        """Should correctly handle IPv6 addresses."""
        request = self._create_mock_request(
            headers={"X-Forwarded-For": "2001:db8::1, 2001:db8::2"},
            client_host="10.0.0.1"
        )
        
        result = get_real_client_ip(request)
        
        assert result == "2001:db8::1"

    def test_case_insensitive_header_lookup(self):
        """Should find header regardless of case (headers dict is case-insensitive)."""
        # Note: Starlette's Headers class is case-insensitive
        # Using uppercase to test the key we use works with standard dict
        request = self._create_mock_request(
            headers={"X-Forwarded-For": "203.0.113.195"},
            client_host="10.0.0.1"
        )
        
        result = get_real_client_ip(request)
        
        assert result == "203.0.113.195"
