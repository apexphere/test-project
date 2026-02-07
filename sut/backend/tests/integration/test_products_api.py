"""Integration tests for Products API endpoints."""
import pytest
from fastapi import status


class TestListProducts:
    """Tests for GET /api/products endpoint."""

    def test_list_products_returns_empty_when_no_products(self, client):
        """Returns empty list when no products exist."""
        response = client.get("/api/products")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1

    def test_list_products_returns_active_products_only(self, client, sample_products):
        """Only returns active products."""
        response = client.get("/api/products")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should have 3 active products (Widget A, B, C), not the inactive one
        assert data["total"] == 3
        names = [item["name"] for item in data["items"]]
        assert "Inactive Widget" not in names

    def test_list_products_pagination(self, client, sample_products):
        """Pagination works correctly."""
        response = client.get("/api/products?page=1&page_size=2")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_products_search_filter(self, client, sample_products):
        """Search filter works correctly."""
        response = client.get("/api/products?search=Widget%20A")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Widget A"

    def test_list_products_category_filter(self, client, sample_products, sample_category):
        """Category filter works correctly."""
        response = client.get(f"/api/products?category_id={sample_category.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 3


class TestGetProduct:
    """Tests for GET /api/products/{product_id} endpoint."""

    def test_get_product_returns_product(self, client, sample_product):
        """Returns product by ID."""
        response = client.get(f"/api/products/{sample_product.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_product.id
        assert data["name"] == "Test Widget"
        assert data["price"] == 29.99

    def test_get_product_not_found(self, client):
        """Returns 404 for non-existent product."""
        response = client.get("/api/products/9999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Product not found"


class TestCreateProduct:
    """Tests for POST /api/products endpoint."""

    def test_create_product_requires_auth(self, client):
        """Requires authentication."""
        response = client.post("/api/products", json={"name": "New", "price": 10.0})
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_product_requires_admin(self, client, auth_headers, sample_category):
        """Requires admin role."""
        response = client.post(
            "/api/products",
            json={"name": "New Product", "price": 10.0, "stock": 5},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin access required" in response.json()["detail"]

    def test_create_product_as_admin(self, client, admin_auth_headers, sample_category):
        """Admin can create products."""
        response = client.post(
            "/api/products",
            json={
                "name": "Admin Created Product",
                "description": "Created by admin",
                "price": 99.99,
                "stock": 50,
                "category_id": sample_category.id,
            },
            headers=admin_auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "Admin Created Product"
        assert data["price"] == 99.99
        assert data["stock"] == 50


class TestUpdateProduct:
    """Tests for PUT /api/products/{product_id} endpoint."""

    def test_update_product_requires_admin(self, client, auth_headers, sample_product):
        """Requires admin role."""
        response = client.put(
            f"/api/products/{sample_product.id}",
            json={"name": "Updated"},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_product_as_admin(self, client, admin_auth_headers, sample_product):
        """Admin can update products."""
        response = client.put(
            f"/api/products/{sample_product.id}",
            json={"name": "Updated Widget", "price": 39.99},
            headers=admin_auth_headers,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Widget"
        assert data["price"] == 39.99

    def test_update_nonexistent_product(self, client, admin_auth_headers):
        """Returns 404 for non-existent product."""
        response = client.put(
            "/api/products/9999",
            json={"name": "Updated"},
            headers=admin_auth_headers,
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestCategories:
    """Tests for category endpoints."""

    def test_list_categories(self, client, sample_category):
        """Lists all categories."""
        response = client.get("/api/products/categories/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Electronics"

    def test_create_category_requires_admin(self, client, auth_headers):
        """Creating category requires admin."""
        response = client.post(
            "/api/products/categories/",
            json={"name": "New Category"},
            headers=auth_headers,
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_category_as_admin(self, client, admin_auth_headers):
        """Admin can create categories."""
        response = client.post(
            "/api/products/categories/",
            json={"name": "New Category", "description": "A new category"},
            headers=admin_auth_headers,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "New Category"
