# API routes — auth is now handled by the external auth-service
from app.api.routes import products, cart, orders

__all__ = ["products", "cart", "orders"]
