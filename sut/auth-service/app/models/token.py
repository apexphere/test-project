"""
Refresh Token Model

Fields:
- id: Primary key
- user_id: Foreign key to users
- token_hash: Hashed refresh token
- expires_at: Expiration timestamp
- created_at: Creation timestamp

Tokens are hashed before storage for security.
"""

# Implementation will go here after design approval
