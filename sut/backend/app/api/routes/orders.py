from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.deps import get_db, get_current_active_user
from app.models.order import Order, OrderItem, CartItem, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse, OrderListResponse

router = APIRouter()


@router.get("", response_model=OrderListResponse)
async def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List current user's orders."""
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    
    order_responses = []
    for order in orders:
        items = []
        for item in order.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "product_name": product.name if product else "Unknown"
            })
        
        order_responses.append({
            "id": order.id,
            "status": order.status,
            "total_amount": order.total_amount,
            "shipping_address": order.shipping_address,
            "items": items,
            "created_at": order.created_at
        })
    
    return {"orders": order_responses, "total": len(order_responses)}


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single order."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "product_name": product.name if product else "Unknown"
        })
    
    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "shipping_address": order.shipping_address,
        "items": items,
        "created_at": order.created_at
    }


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create order from cart."""
    # Get cart items
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    
    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty"
        )
    
    # Validate stock and calculate total
    total_amount = 0.0
    order_items_data = []
    
    for cart_item in cart_items:
        product = db.query(Product).filter(Product.id == cart_item.product_id).first()
        
        if not product or not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {cart_item.product_id} is not available"
            )
        
        if product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {product.name}"
            )
        
        order_items_data.append({
            "product_id": product.id,
            "quantity": cart_item.quantity,
            "unit_price": product.price,
            "product_name": product.name
        })
        
        total_amount += product.price * cart_item.quantity
        
        # Decrease stock
        product.stock -= cart_item.quantity
    
    # Create order
    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING.value,
        total_amount=total_amount,
        shipping_address=order_data.shipping_address
    )
    db.add(order)
    db.flush()  # Get order.id
    
    # Create order items
    items_response = []
    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"]
        )
        db.add(order_item)
        items_response.append({
            "id": 0,  # Will be set after commit
            "product_id": item_data["product_id"],
            "quantity": item_data["quantity"],
            "unit_price": item_data["unit_price"],
            "product_name": item_data["product_name"]
        })
    
    # Clear cart
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    
    db.commit()
    db.refresh(order)
    
    # Update item IDs
    for i, item in enumerate(order.items):
        items_response[i]["id"] = item.id
    
    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "shipping_address": order.shipping_address,
        "items": items_response,
        "created_at": order.created_at
    }


@router.patch("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel an order (only if pending)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order.status != OrderStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending orders can be cancelled"
        )
    
    # Restore stock
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product.stock += item.quantity
    
    order.status = OrderStatus.CANCELLED.value
    db.commit()
    db.refresh(order)
    
    items = []
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "product_name": product.name if product else "Unknown"
        })
    
    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "shipping_address": order.shipping_address,
        "items": items,
        "created_at": order.created_at
    }
