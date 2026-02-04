from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.deps import get_db, get_current_active_user
from app.models.order import CartItem
from app.models.product import Product
from app.models.user import User
from app.schemas.order import CartItemCreate, CartItemUpdate, CartItemResponse, CartResponse

router = APIRouter()


@router.get("", response_model=CartResponse)
async def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's cart."""
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    
    items = []
    total = 0.0
    
    for item in cart_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            subtotal = product.price * item.quantity
            total += subtotal
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "quantity": item.quantity,
                "product_name": product.name,
                "unit_price": product.price,
                "subtotal": subtotal
            })
    
    return {"items": items, "total": total}


@router.post("", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    item_data: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add item to cart."""
    # Verify product exists and is active
    product = db.query(Product).filter(
        Product.id == item_data.product_id,
        Product.is_active == True
    ).first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Check stock
    if product.stock < item_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock"
        )
    
    # Check if item already in cart
    existing = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == item_data.product_id
    ).first()
    
    if existing:
        existing.quantity += item_data.quantity
        db.commit()
        db.refresh(existing)
        return {
            "id": existing.id,
            "product_id": existing.product_id,
            "quantity": existing.quantity,
            "product_name": product.name,
            "unit_price": product.price,
            "subtotal": product.price * existing.quantity
        }
    
    # Create new cart item
    cart_item = CartItem(
        user_id=current_user.id,
        product_id=item_data.product_id,
        quantity=item_data.quantity
    )
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    
    return {
        "id": cart_item.id,
        "product_id": cart_item.product_id,
        "quantity": cart_item.quantity,
        "product_name": product.name,
        "unit_price": product.price,
        "subtotal": product.price * cart_item.quantity
    }


@router.put("/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: int,
    item_data: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update cart item quantity."""
    cart_item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found"
        )
    
    product = db.query(Product).filter(Product.id == cart_item.product_id).first()
    
    if item_data.quantity > product.stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock"
        )
    
    cart_item.quantity = item_data.quantity
    db.commit()
    db.refresh(cart_item)
    
    return {
        "id": cart_item.id,
        "product_id": cart_item.product_id,
        "quantity": cart_item.quantity,
        "product_name": product.name,
        "unit_price": product.price,
        "subtotal": product.price * cart_item.quantity
    }


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove item from cart."""
    cart_item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.user_id == current_user.id
    ).first()
    
    if not cart_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found"
        )
    
    db.delete(cart_item)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clear entire cart."""
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    db.commit()
