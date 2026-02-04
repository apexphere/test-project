from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CartItemBase(BaseModel):
    """Base cart item schema."""
    product_id: int
    quantity: int = 1


class CartItemCreate(CartItemBase):
    """Schema for adding to cart."""
    pass


class CartItemUpdate(BaseModel):
    """Schema for updating cart item."""
    quantity: int


class CartItemResponse(CartItemBase):
    """Schema for cart item response."""
    id: int
    product_name: Optional[str] = None
    unit_price: Optional[float] = None
    subtotal: Optional[float] = None
    
    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    """Full cart response."""
    items: List[CartItemResponse]
    total: float


class OrderItemBase(BaseModel):
    """Base order item schema."""
    product_id: int
    quantity: int
    unit_price: float


class OrderItemResponse(OrderItemBase):
    """Schema for order item response."""
    id: int
    product_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    """Schema for order creation."""
    shipping_address: str


class OrderResponse(BaseModel):
    """Schema for order response."""
    id: int
    status: str
    total_amount: float
    shipping_address: Optional[str] = None
    items: List[OrderItemResponse]
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    """Order list response."""
    orders: List[OrderResponse]
    total: int
