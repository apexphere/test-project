"""Integration tests for Cart API endpoints."""
import pytest
from fastapi import status

from app.models.order import CartItem


class TestGetCart:
    """Tests for GET /api/cart endpoint."""

    def test_get_cart_requires_auth(self, client):
        """Requires authentication."""
        response = client.get("/api/cart")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_cart_returns_empty_cart(self, client, auth_headers):
        """Returns empty cart for new user."""
        response = client.get("/api/cart", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0.0

    def test_get_cart_with_items(self, client, auth_headers, sample_user, sample_product, db_session):
        """Returns cart with items."""
        # Add item to cart directly
        cart_item = CartItem(
            user_id=sample_user.id,
            product_id=sample_product.id,
            quantity=2,
        )
        db_session.add(cart_item)
        db_session.commit()
        
        response = client.get("/api/cart", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["product_id"] == sample_product.id
        assert data["items"][0]["quantity"] == 2
        assert data["total"] == sample_product.price * 2


class TestAddToCart:
    """Tests for POST /api/cart endpoint."""

    def test_add_to_cart_requires_auth(self, client, sample_product):
        """Requires authentication."""
        response = client.post("/api/cart", json={"product_id": sample_product.id, "quantity": 1})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_add_to_cart_success(self, client, auth_headers, sample_product):
        """Successfully adds item to cart."""
        response = client.post(
            "/api/cart",
            json={"product_id": sample_product.id, "quantity": 2},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["product_id"] == sample_product.id
        assert data["quantity"] == 2
        assert data["unit_price"] == sample_product.price
        assert data["subtotal"] == sample_product.price * 2

    def test_add_to_cart_product_not_found(self, client, auth_headers):
        """Returns 404 for non-existent product."""
        response = client.post(
            "/api/cart",
            json={"product_id": 9999, "quantity": 1},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_add_to_cart_insufficient_stock(self, client, auth_headers, sample_product):
        """Returns error when insufficient stock."""
        response = client.post(
            "/api/cart",
            json={"product_id": sample_product.id, "quantity": 9999},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Insufficient stock" in response.json()["detail"]

    def test_add_to_cart_increments_existing(self, client, auth_headers, sample_product):
        """Adding same product increments quantity."""
        # Add first time
        client.post(
            "/api/cart",
            json={"product_id": sample_product.id, "quantity": 2},
            headers=auth_headers,
        )
        
        # Add again
        response = client.post(
            "/api/cart",
            json={"product_id": sample_product.id, "quantity": 3},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["quantity"] == 5  # 2 + 3


class TestUpdateCartItem:
    """Tests for PUT /api/cart/{item_id} endpoint."""

    def test_update_cart_item(self, client, auth_headers, sample_user, sample_product, db_session):
        """Updates cart item quantity."""
        cart_item = CartItem(user_id=sample_user.id, product_id=sample_product.id, quantity=2)
        db_session.add(cart_item)
        db_session.commit()
        db_session.refresh(cart_item)
        
        response = client.put(
            f"/api/cart/{cart_item.id}",
            json={"quantity": 5},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["quantity"] == 5

    def test_update_cart_item_not_found(self, client, auth_headers):
        """Returns 404 for non-existent cart item."""
        response = client.put(
            "/api/cart/9999",
            json={"quantity": 5},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_cart_item_insufficient_stock(self, client, auth_headers, sample_user, sample_product, db_session):
        """Returns error when updating beyond stock."""
        cart_item = CartItem(user_id=sample_user.id, product_id=sample_product.id, quantity=2)
        db_session.add(cart_item)
        db_session.commit()
        db_session.refresh(cart_item)
        
        response = client.put(
            f"/api/cart/{cart_item.id}",
            json={"quantity": 9999},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestRemoveFromCart:
    """Tests for DELETE /api/cart/{item_id} endpoint."""

    def test_remove_cart_item(self, client, auth_headers, sample_user, sample_product, db_session):
        """Removes cart item."""
        cart_item = CartItem(user_id=sample_user.id, product_id=sample_product.id, quantity=2)
        db_session.add(cart_item)
        db_session.commit()
        db_session.refresh(cart_item)
        
        response = client.delete(f"/api/cart/{cart_item.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify item is gone
        get_response = client.get("/api/cart", headers=auth_headers)
        assert len(get_response.json()["items"]) == 0

    def test_remove_nonexistent_cart_item(self, client, auth_headers):
        """Returns 404 for non-existent item."""
        response = client.delete("/api/cart/9999", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestClearCart:
    """Tests for DELETE /api/cart endpoint."""

    def test_clear_cart(self, client, auth_headers, sample_user, sample_products, db_session):
        """Clears all cart items."""
        # Add multiple items
        for product in sample_products[:2]:
            cart_item = CartItem(user_id=sample_user.id, product_id=product.id, quantity=1)
            db_session.add(cart_item)
        db_session.commit()
        
        response = client.delete("/api/cart", headers=auth_headers)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify cart is empty
        get_response = client.get("/api/cart", headers=auth_headers)
        assert len(get_response.json()["items"]) == 0
