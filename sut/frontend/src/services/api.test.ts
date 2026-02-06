import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import axios from 'axios';
import { authApi, productsApi, cartApi, ordersApi } from './api';

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

// Get the mocked axios instances
const mockAxios = axios.create() as unknown as {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
};

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should send login request with form data', async () => {
      const mockResponse = { access_token: 'test-token', token_type: 'bearer' };
      mockAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await authApi.login({ email: 'test@example.com', password: 'password123' });

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed login', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(authApi.login({ email: 'test@example.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should send registration data', async () => {
      const userData = { email: 'new@example.com', password: 'password123', full_name: 'Test User' };
      const mockUser = { id: 1, email: 'new@example.com', full_name: 'Test User', is_active: true, created_at: '2024-01-01' };
      mockAxios.post.mockResolvedValueOnce({ data: mockUser });

      const result = await authApi.register(userData);

      expect(mockAxios.post).toHaveBeenCalledWith('/auth/register', userData);
      expect(result).toEqual(mockUser);
    });
  });

  describe('getMe', () => {
    it('should fetch current user', async () => {
      const mockUser = { id: 1, email: 'test@example.com', full_name: 'Test User', is_active: true, created_at: '2024-01-01' };
      mockAxios.get.mockResolvedValueOnce({ data: mockUser });

      const result = await authApi.getMe();

      expect(mockAxios.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });
  });
});

describe('productsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should fetch products with default pagination', async () => {
      const mockResponse = { items: [], total: 0, page: 1, page_size: 10 };
      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await productsApi.list();

      expect(mockAxios.get).toHaveBeenCalledWith('/products?page=1&page_size=10');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch products with custom pagination', async () => {
      const mockResponse = { items: [], total: 50, page: 2, page_size: 20 };
      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await productsApi.list(2, 20);

      expect(mockAxios.get).toHaveBeenCalledWith('/products?page=2&page_size=20');
      expect(result).toEqual(mockResponse);
    });

    it('should include category filter when provided', async () => {
      const mockResponse = { items: [], total: 10, page: 1, page_size: 10 };
      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      await productsApi.list(1, 10, 5);

      expect(mockAxios.get).toHaveBeenCalledWith('/products?page=1&page_size=10&category_id=5');
    });

    it('should include search filter when provided', async () => {
      const mockResponse = { items: [], total: 5, page: 1, page_size: 10 };
      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      await productsApi.list(1, 10, undefined, 'laptop');

      expect(mockAxios.get).toHaveBeenCalledWith('/products?page=1&page_size=10&search=laptop');
    });
  });

  describe('get', () => {
    it('should fetch single product by id', async () => {
      const mockProduct = { id: 1, name: 'Test Product', price: 99.99 };
      mockAxios.get.mockResolvedValueOnce({ data: mockProduct });

      const result = await productsApi.get(1);

      expect(mockAxios.get).toHaveBeenCalledWith('/products/1');
      expect(result).toEqual(mockProduct);
    });
  });
});

describe('cartApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should fetch cart', async () => {
      const mockCart = { items: [], total: 0 };
      mockAxios.get.mockResolvedValueOnce({ data: mockCart });

      const result = await cartApi.get();

      expect(mockAxios.get).toHaveBeenCalledWith('/cart');
      expect(result).toEqual(mockCart);
    });
  });

  describe('addItem', () => {
    it('should add item with default quantity', async () => {
      const mockItem = { id: 1, product_id: 5, quantity: 1, product_name: 'Test', unit_price: 10, subtotal: 10 };
      mockAxios.post.mockResolvedValueOnce({ data: mockItem });

      const result = await cartApi.addItem(5);

      expect(mockAxios.post).toHaveBeenCalledWith('/cart', { product_id: 5, quantity: 1 });
      expect(result).toEqual(mockItem);
    });

    it('should add item with custom quantity', async () => {
      const mockItem = { id: 1, product_id: 5, quantity: 3, product_name: 'Test', unit_price: 10, subtotal: 30 };
      mockAxios.post.mockResolvedValueOnce({ data: mockItem });

      const result = await cartApi.addItem(5, 3);

      expect(mockAxios.post).toHaveBeenCalledWith('/cart', { product_id: 5, quantity: 3 });
      expect(result).toEqual(mockItem);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      const mockItem = { id: 1, product_id: 5, quantity: 5, product_name: 'Test', unit_price: 10, subtotal: 50 };
      mockAxios.put.mockResolvedValueOnce({ data: mockItem });

      const result = await cartApi.updateItem(1, 5);

      expect(mockAxios.put).toHaveBeenCalledWith('/cart/1', { quantity: 5 });
      expect(result).toEqual(mockItem);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      mockAxios.delete.mockResolvedValueOnce({});

      await cartApi.removeItem(1);

      expect(mockAxios.delete).toHaveBeenCalledWith('/cart/1');
    });
  });

  describe('clear', () => {
    it('should clear the cart', async () => {
      mockAxios.delete.mockResolvedValueOnce({});

      await cartApi.clear();

      expect(mockAxios.delete).toHaveBeenCalledWith('/cart');
    });
  });
});

describe('ordersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should fetch orders list', async () => {
      const mockResponse = { orders: [], total: 0 };
      mockAxios.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await ordersApi.list();

      expect(mockAxios.get).toHaveBeenCalledWith('/orders');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get', () => {
    it('should fetch single order by id', async () => {
      const mockOrder = { id: 1, status: 'pending', total_amount: 100, items: [] };
      mockAxios.get.mockResolvedValueOnce({ data: mockOrder });

      const result = await ordersApi.get(1);

      expect(mockAxios.get).toHaveBeenCalledWith('/orders/1');
      expect(result).toEqual(mockOrder);
    });
  });

  describe('create', () => {
    it('should create order with shipping address', async () => {
      const mockOrder = { id: 1, status: 'pending', total_amount: 100, shipping_address: '123 Main St', items: [] };
      mockAxios.post.mockResolvedValueOnce({ data: mockOrder });

      const result = await ordersApi.create('123 Main St');

      expect(mockAxios.post).toHaveBeenCalledWith('/orders', { shipping_address: '123 Main St' });
      expect(result).toEqual(mockOrder);
    });
  });

  describe('cancel', () => {
    it('should cancel order', async () => {
      const mockOrder = { id: 1, status: 'cancelled', total_amount: 100, items: [] };
      mockAxios.patch.mockResolvedValueOnce({ data: mockOrder });

      const result = await ordersApi.cancel(1);

      expect(mockAxios.patch).toHaveBeenCalledWith('/orders/1/cancel');
      expect(result).toEqual(mockOrder);
    });
  });
});
