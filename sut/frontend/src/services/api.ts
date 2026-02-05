import axios from 'axios';
import type { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthToken,
  Product,
  ProductListResponse,
  Cart,
  CartItem,
  Order,
  OrderListResponse 
} from '../types';

// Backend API — products, cart, orders
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Auth service — login, register, me
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

const authClient = axios.create({
  baseURL: AUTH_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to both clients
const addAuthToken = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(addAuthToken);
authClient.interceptors.request.use(addAuthToken);

// Auth API — talks to auth-service
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthToken> => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    
    const { data } = await authClient.post<AuthToken>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    const { data } = await authClient.post<User>('/auth/register', userData);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await authClient.get<User>('/auth/me');
    return data;
  },
};

// Products API
export const productsApi = {
  list: async (page = 1, pageSize = 10, categoryId?: number, search?: string): Promise<ProductListResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (categoryId) params.append('category_id', categoryId.toString());
    if (search) params.append('search', search);
    
    const { data } = await api.get<ProductListResponse>(`/products?${params}`);
    return data;
  },

  get: async (id: number): Promise<Product> => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
};

// Cart API
export const cartApi = {
  get: async (): Promise<Cart> => {
    const { data } = await api.get<Cart>('/cart');
    return data;
  },

  addItem: async (productId: number, quantity = 1): Promise<CartItem> => {
    const { data } = await api.post<CartItem>('/cart', { product_id: productId, quantity });
    return data;
  },

  updateItem: async (itemId: number, quantity: number): Promise<CartItem> => {
    const { data } = await api.put<CartItem>(`/cart/${itemId}`, { quantity });
    return data;
  },

  removeItem: async (itemId: number): Promise<void> => {
    await api.delete(`/cart/${itemId}`);
  },

  clear: async (): Promise<void> => {
    await api.delete('/cart');
  },
};

// Orders API
export const ordersApi = {
  list: async (): Promise<OrderListResponse> => {
    const { data } = await api.get<OrderListResponse>('/orders');
    return data;
  },

  get: async (id: number): Promise<Order> => {
    const { data } = await api.get<Order>(`/orders/${id}`);
    return data;
  },

  create: async (shippingAddress: string): Promise<Order> => {
    const { data } = await api.post<Order>('/orders', { shipping_address: shippingAddress });
    return data;
  },

  cancel: async (id: number): Promise<Order> => {
    const { data } = await api.patch<Order>(`/orders/${id}/cancel`);
    return data;
  },
};

export default api;
