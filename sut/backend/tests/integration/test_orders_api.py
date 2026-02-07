"""Integration tests for Orders API endpoints."""
import pytest
from fastapi import status

from app.models.order import CartItem, Order, OrderItem, OrderStatus


class TestListOrders:
    """Tests for GET /api/orders endpoint."""

    def test_list_orders_requires_auth(self, client):
        """Requires authentication."""
        response = client.get("/api/orders")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_orders_returns_empty(self, client, auth_headers):
        """Returns empty list when no orders exist."""
        response = client.get("/api/orders", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["orders"] == []
        assert data["total"] == 0

    def test_list_orders_returns_user_orders(self, client, auth_headers, sample_user, sample_product, db_session):
        """Returns orders for authenticated user."""
        # Create order directly
        order = Order(
            user_id=sample_user.id,
            status=OrderStatus.PENDING.value,
            total_amount=59.98,
            shipping_address="123 Test St",
        )
        db_session.add(order)
        db_session.flush()
        
        order_item = OrderItem(
            order_id=order.id,
            product_id=sample_product.id,
            quantity=2,
            unit_price=29.99,
        )
        db_session.add(order_item)
        db_session.commit()
        
        response = client.get("/api/orders", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["orders"][0]["status"] == "pending"
        assert data["orders"][0]["total_amount"] == 59.98


class TestGetOrder:
    """Tests for GET /api/orders/{order_id} endpoint."""

    def test_get_order_returns_order(self, client, auth_headers, sample_user, sample_product, db_session):
        """Returns order by ID."""
        order = Order(
            user_id=sample_user.id,
            status=OrderStatus.PENDING.value,
            total_amount=29.99,
            shipping_address="123 Test St",
        )
        db_session.add(order)
        db_session.flush()
        
        order_item = OrderItem(
            order_id=order.id,
            product_id=sample_product.id,
            quantity=1,
            unit_price=29.99,
        )
        db_session.add(order_item)
        db_session.commit()
        db_session.refresh(order)
        
        response = client.get(f"/api/orders/{order.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == order.id
        assert data["shipping_address"] == "123 Test St"
        assert len(data["items"]) == 1

    def test_get_order_not_found(self, client, auth_headers):
        """Returns 404 for non-existent order."""
        response = client.get("/api/orders/9999", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestCreateOrder:
    """Tests for POST /api/orders endpoint."""

    def test_create_order_requires_auth(self, client):
        """Requires authentication."""
        response = client.post("/api/orders", json={"shipping_address": "123 St"})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_order_empty_cart(self, client, auth_headers):
        """Returns error when cart is empty."""
        response = client.post(
            "/api/orders",
            json={"shipping_address": "123 Test St"},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cart is empty" in response.json()["detail"]

    def test_create_order_success(self, client, auth_headers, sample_user, sample_product, db_session):
        """Successfully creates order from cart."""
        # Add item to cart
        cart_item = CartItem(user_id=sample_user.id, product_id=sample_product.id, quantity=2)
        db_session.add(cart_item)
        db_session.commit()
        
        initial_stock = sample_product.stock
        
        response = client.post(
            "/api/orders",
            json={"shipping_address": "456 Delivery Ave"},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["status"] == "pending"
        assert data["shipping_address"] == "456 Delivery Ave"
        assert data["total_amount"] == sample_product.price * 2
        assert len(data["items"]) == 1
        
        # Verify cart is cleared
        cart_response = client.get("/api/cart", headers=auth_headers)
        assert len(cart_response.json()["items"]) == 0
        
        # Verify stock decreased
        db_session.refresh(sample_product)
        assert sample_product.stock == initial_stock - 2

    def test_create_order_insufficient_stock(self, client, auth_headers, sample_user, sample_product, db_session):
        """Returns error when product has insufficient stock."""
        # Set stock to 0
        sample_product.stock = 0
        db_session.commit()
        
        # Add item to cart (we need to bypass stock check)
        cart_item = CartItem(user_id=sample_user.id, product_id=sample_product.id, quantity=5)
        db_session.add(cart_item)
        db_session.commit()
        
        response = client.post(
            "/api/orders",
            json={"shipping_address": "123 Test St"},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Insufficient stock" in response.json()["detail"]


class TestCancelOrder:
    """Tests for PATCH /api/orders/{order_id}/cancel endpoint."""

    def test_cancel_pending_order(self, client, auth_headers, sample_user, sample_product, db_session):
        """Can cancel pending order and restore stock."""
        initial_stock = sample_product.stock
        
        # Create order
        order = Order(
            user_id=sample_user.id,
            status=OrderStatus.PENDING.value,
            total_amount=29.99,
            shipping_address="123 Test St",
        )
        db_session.add(order)
        db_session.flush()
        
        order_item = OrderItem(
            order_id=order.id,
            product_id=sample_product.id,
            quantity=2,
            unit_price=29.99,
        )
        db_session.add(order_item)
        
        # Decrease stock (simulating order creation)
        sample_product.stock -= 2
        db_session.commit()
        db_session.refresh(order)
        
        response = client.patch(f"/api/orders/{order.id}/cancel", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "cancelled"
        
        # Verify stock restored
        db_session.refresh(sample_product)
        assert sample_product.stock == initial_stock

    def test_cancel_shipped_order_fails(self, client, auth_headers, sample_user, sample_product, db_session):
        """Cannot cancel shipped order."""
        order = Order(
            user_id=sample_user.id,
            status=OrderStatus.SHIPPED.value,
            total_amount=29.99,
            shipping_address="123 Test St",
        )
        db_session.add(order)
        db_session.commit()
        db_session.refresh(order)
        
        response = client.patch(f"/api/orders/{order.id}/cancel", headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only pending orders can be cancelled" in response.json()["detail"]

    def test_cancel_order_not_found(self, client, auth_headers):
        """Returns 404 for non-existent order."""
        response = client.patch("/api/orders/9999/cancel", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
