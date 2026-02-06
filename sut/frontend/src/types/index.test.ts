import { describe, it, expect } from 'vitest';
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthToken,
  Product,
  ProductListResponse,
  CartItem,
  Cart,
  Order,
  OrderItem,
  OrderListResponse,
  Category,
} from './index';

// Type validation tests - ensure types are correctly structured
describe('Types', () => {
  describe('User type', () => {
    it('should accept valid user object', () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(user.id).toBe(1);
      expect(user.email).toBe('test@example.com');
    });

    it('should accept null full_name', () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        full_name: null,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(user.full_name).toBeNull();
    });
  });

  describe('LoginCredentials type', () => {
    it('should accept valid credentials', () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };
      expect(credentials.email).toBeDefined();
      expect(credentials.password).toBeDefined();
    });
  });

  describe('RegisterData type', () => {
    it('should accept registration data with optional full_name', () => {
      const data: RegisterData = {
        email: 'test@example.com',
        password: 'password123',
      };
      expect(data.full_name).toBeUndefined();

      const dataWithName: RegisterData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
      };
      expect(dataWithName.full_name).toBe('Test User');
    });
  });

  describe('AuthToken type', () => {
    it('should accept valid token response', () => {
      const token: AuthToken = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'bearer',
      };
      expect(token.access_token).toBeDefined();
      expect(token.token_type).toBe('bearer');
    });
  });

  describe('Product type', () => {
    it('should accept valid product with category', () => {
      const category: Category = {
        id: 1,
        name: 'Electronics',
        description: 'Electronic devices',
      };
      const product: Product = {
        id: 1,
        name: 'Laptop',
        description: 'A powerful laptop',
        price: 999.99,
        stock: 10,
        image_url: 'https://example.com/laptop.jpg',
        is_active: true,
        category,
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(product.category).toEqual(category);
    });

    it('should accept product with null optional fields', () => {
      const product: Product = {
        id: 1,
        name: 'Test Product',
        description: null,
        price: 49.99,
        stock: 5,
        image_url: null,
        is_active: true,
        category: null,
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(product.description).toBeNull();
      expect(product.image_url).toBeNull();
      expect(product.category).toBeNull();
    });
  });

  describe('ProductListResponse type', () => {
    it('should accept valid paginated response', () => {
      const response: ProductListResponse = {
        items: [],
        total: 100,
        page: 1,
        page_size: 10,
      };
      expect(response.items).toEqual([]);
      expect(response.total).toBe(100);
    });
  });

  describe('Cart types', () => {
    it('should accept valid cart item', () => {
      const item: CartItem = {
        id: 1,
        product_id: 5,
        quantity: 2,
        product_name: 'Test Product',
        unit_price: 29.99,
        subtotal: 59.98,
      };
      expect(item.subtotal).toBe(item.unit_price * item.quantity);
    });

    it('should accept valid cart', () => {
      const cart: Cart = {
        items: [
          { id: 1, product_id: 5, quantity: 2, product_name: 'Product 1', unit_price: 10, subtotal: 20 },
          { id: 2, product_id: 6, quantity: 1, product_name: 'Product 2', unit_price: 15, subtotal: 15 },
        ],
        total: 35,
      };
      expect(cart.items.length).toBe(2);
      expect(cart.total).toBe(35);
    });
  });

  describe('Order types', () => {
    it('should accept valid order item', () => {
      const item: OrderItem = {
        id: 1,
        product_id: 5,
        quantity: 2,
        unit_price: 29.99,
        product_name: 'Test Product',
      };
      expect(item.product_name).toBeDefined();
    });

    it('should accept valid order', () => {
      const order: Order = {
        id: 1,
        status: 'pending',
        total_amount: 99.99,
        shipping_address: '123 Main St',
        items: [],
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(order.status).toBe('pending');
    });

    it('should accept order with null shipping_address', () => {
      const order: Order = {
        id: 1,
        status: 'pending',
        total_amount: 99.99,
        shipping_address: null,
        items: [],
        created_at: '2024-01-01T00:00:00Z',
      };
      expect(order.shipping_address).toBeNull();
    });

    it('should accept valid order list response', () => {
      const response: OrderListResponse = {
        orders: [],
        total: 10,
      };
      expect(response.orders).toEqual([]);
      expect(response.total).toBe(10);
    });
  });
});
