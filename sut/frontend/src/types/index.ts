// User types
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// Product types
export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  category: Category | null;
  created_at: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

// Cart types
export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  product_name: string;
  unit_price: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

// Order types
export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product_name: string;
}

export interface Order {
  id: number;
  status: string;
  total_amount: number;
  shipping_address: string | null;
  items: OrderItem[];
  created_at: string;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
}
