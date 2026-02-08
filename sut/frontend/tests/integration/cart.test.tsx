import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Cart } from '../../src/pages/Cart';
import { Login } from '../../src/pages/Login';
import { ProtectedRoute } from '../../src/components/ProtectedRoute';
import { AuthProvider } from '../../src/store/AuthContext';
import { server } from '../mocks/server';
import { errorHandlers } from '../mocks/handlers';
import { http, HttpResponse } from 'msw';

// Create wrapper with auth pre-configured
function createWrapper(authenticated = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Set token before rendering if authenticated
  if (authenticated) {
    localStorage.setItem('token', 'mock-jwt-token');
  }

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

// Create wrapper with MemoryRouter for testing protected routes
function createProtectedRouteWrapper(authenticated = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (authenticated) {
    localStorage.setItem('token', 'mock-jwt-token');
  }

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/cart']}>
            <Routes>
              <Route path="/cart" element={<ProtectedRoute>{children}</ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('Cart Integration', () => {
  describe('Unauthenticated user', () => {
    it('redirects unauthenticated user to login page', async () => {
      render(<Cart />, { wrapper: createProtectedRouteWrapper(false) });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated user', () => {
    beforeEach(() => {
      localStorage.setItem('token', 'mock-jwt-token');
    });

    it('fetches and displays cart items', async () => {
      render(<Cart />, { wrapper: createWrapper(true) });

      // Wait for auth to complete and cart to load
      await waitFor(() => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText('$99.99')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // quantity
      expect(screen.getByText('$199.98')).toBeInTheDocument(); // subtotal
    });

    it('displays cart total correctly', async () => {
      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Total: $199.98')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('allows updating item quantity', async () => {
      const user = userEvent.setup();
      let updateCalled = false;

      server.use(
        http.put('http://localhost:8000/api/cart/:itemId', async ({ request }) => {
          updateCalled = true;
          const body = await request.json() as { quantity: number };
          return HttpResponse.json({
            id: 1,
            product_id: 1,
            quantity: body.quantity,
            product_name: 'Wireless Headphones',
            unit_price: 99.99,
            subtotal: 99.99 * body.quantity,
          });
        })
      );

      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click + button to increase quantity
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      await user.click(plusButtons[0]);

      await waitFor(() => {
        expect(updateCalled).toBe(true);
      });
    });

    it('allows removing item from cart', async () => {
      const user = userEvent.setup();
      let deleteCalled = false;

      server.use(
        http.delete('http://localhost:8000/api/cart/:itemId', () => {
          deleteCalled = true;
          return new HttpResponse(null, { status: 204 });
        }),
        http.get('http://localhost:8000/api/cart', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
            return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
          }
          // Return empty cart after delete
          if (deleteCalled) {
            return HttpResponse.json({ items: [], total: 0 });
          }
          return HttpResponse.json({
            items: [{
              id: 1, product_id: 1, quantity: 2,
              product_name: 'Wireless Headphones',
              unit_price: 99.99, subtotal: 199.98,
            }],
            total: 199.98,
          });
        })
      );

      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click remove button
      const removeButton = screen.getByRole('button', { name: '✕' });
      await user.click(removeButton);

      await waitFor(() => {
        expect(deleteCalled).toBe(true);
      });
    });

    it('shows empty cart message when cart is empty', async () => {
      server.use(
        http.get('http://localhost:8000/api/cart', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) {
            return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
          }
          return HttpResponse.json({ items: [], total: 0 });
        })
      );

      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('displays error when cart fails to load', async () => {
      server.use(
        http.get('http://localhost:8000/api/cart', () => {
          return HttpResponse.json({ detail: 'Failed to load cart' }, { status: 500 });
        })
      );

      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Failed to load cart')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('validates shipping address before checkout', async () => {
      const user = userEvent.setup();
      render(<Cart />, { wrapper: createWrapper(true) });

      await waitFor(() => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Try to checkout without shipping address
      const checkoutButton = screen.getByRole('button', { name: 'Place Order' });
      await user.click(checkoutButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a shipping address')).toBeInTheDocument();
      });
    });
  });
});
