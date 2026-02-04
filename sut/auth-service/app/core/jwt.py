"""
JWT Token Utilities

Functions:
- create_access_token(user) - Create signed JWT access token
- create_refresh_token(user) - Create refresh token
- decode_token(token) - Decode and validate JWT
- get_public_key() - Get public key for distribution

Uses RS256 algorithm (asymmetric) for signing.
Private key stays in Auth Service.
Public key is distributed to other services.
"""

# Implementation will go here after design approval
