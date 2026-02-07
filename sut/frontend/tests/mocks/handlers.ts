import { http, HttpResponse, delay } from 'msw';

// Mock data
export const mockProducts = [
  {
    id: 1,
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones',
    price: 99.99,
    stock: 50,
    image_url: null,
    is_active: true,
    category: { id: 1, name: 'Electronics', description: null },
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Coffee Mug',
    description: 'Ceramic coffee mug',
    price: 14.99,
    stock: 100,
    image_url: null,
    is_active: true,
    category: { id: 2, name: 'Kitchen', description: null },
    created_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    name: 'Laptop Stand',
    description: 'Ergonomic laptop stand',
    price: 49.99,
    stock: 30,
    image_url: null,
    is_active: true,
    category: { id: 1, name: 'Electronics', description: null },
    created_at: '2024-01-03T00:00:00Z',
  },
];

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockCart = {
  items: [
    {
      id: 1,
      product_id: 1,
      quantity: 2,
      product_name: 'Wireless Headphones',
      unit_price: 99.99,
      subtotal: 199.98,
    },
  ],
  total: 199.98,
};

export const mockEmptyCart = {
  items: [],
  total: 0,
};

const API_URL = 'http://localhost:8000';
const AUTH_URL = 'http://localhost:8001';

export const handlers = [
  // Products API
  http.get(`${API_URL}/api/products`, async ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    
    let filteredProducts = mockProducts;
    if (search) {
      filteredProducts = mockProducts.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    await delay(50); // Small delay to simulate network
    return HttpResponse.json({
      items: filteredProducts,
      total: filteredProducts.length,
      page: 1,
      page_size: 12,
    });
  }),

  // Auth API - Login
  http.post(`${AUTH_URL}/auth/login`, async ({ request }) => {
    const formData = await request.text();
    const params = new URLSearchParams(formData);
    const username = params.get('username');
    const password = params.get('password');

    await delay(50);

    if (username === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token',
        token_type: 'bearer',
      });
    }

    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Auth API - Get current user
  http.get(`${AUTH_URL}/auth/me`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    await delay(50);

    if (authHeader === 'Bearer mock-jwt-token') {
      return HttpResponse.json(mockUser);
    }

    return HttpResponse.json(
      { detail: 'Not authenticated' },
      { status: 401 }
    );
  }),

  // Cart API - Get cart
  http.get(`${API_URL}/api/cart`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    await delay(50);

    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    return HttpResponse.json(mockCart);
  }),

  // Cart API - Add item
  http.post(`${API_URL}/api/cart`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { product_id: number; quantity: number };
    await delay(50);

    return HttpResponse.json({
      id: 2,
      product_id: body.product_id,
      quantity: body.quantity,
      product_name: 'Coffee Mug',
      unit_price: 14.99,
      subtotal: 14.99 * body.quantity,
    });
  }),

  // Cart API - Update item
  http.put(`${API_URL}/api/cart/:itemId`, async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as { quantity: number };
    await delay(50);

    return HttpResponse.json({
      id: Number(params.itemId),
      product_id: 1,
      quantity: body.quantity,
      product_name: 'Wireless Headphones',
      unit_price: 99.99,
      subtotal: 99.99 * body.quantity,
    });
  }),

  // Cart API - Remove item
  http.delete(`${API_URL}/api/cart/:itemId`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 }
      );
    }

    await delay(50);
    return new HttpResponse(null, { status: 204 });
  }),
];

// Error handlers for testing error scenarios
export const errorHandlers = {
  productsError: http.get(`${API_URL}/api/products`, () => {
    return HttpResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }),
  
  loginError: http.post(`${AUTH_URL}/auth/login`, () => {
    return HttpResponse.json(
      { detail: 'Service unavailable' },
      { status: 503 }
    );
  }),
  
  cartError: http.get(`${API_URL}/api/cart`, () => {
    return HttpResponse.json(
      { detail: 'Failed to load cart' },
      { status: 500 }
    );
  }),
};
