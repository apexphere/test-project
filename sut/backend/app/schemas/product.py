from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    """Schema for category creation."""
    pass


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    id: int
    
    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    """Base product schema."""
    name: str
    description: Optional[str] = None
    price: float
    stock: int = 0
    image_url: Optional[str] = None
    category_id: Optional[int] = None


class ProductCreate(ProductBase):
    """Schema for product creation."""
    pass


class ProductUpdate(BaseModel):
    """Schema for product update."""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    category_id: Optional[int] = None


class ProductResponse(ProductBase):
    """Schema for product response."""
    id: int
    is_active: bool
    category: Optional[CategoryResponse] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Paginated product list."""
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
