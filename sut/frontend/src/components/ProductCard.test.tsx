/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from './ProductCard';
import type { Product } from '../types';

// Mock useAuth
let mockAuthState = {
  isAuthenticated: false,
};

vi.mock('../store/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock cartApi
const mockAddItem = vi.fn();
vi.mock('../services/api', () => ({
  cartApi: {
    addItem: (...args: unknown[]) => mockAddItem(...args),
  },
}));

const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Test Product',
  description: 'A great product for testing',
  price: 29.99,
  stock: 10,
  image_url: 'https://example.com/product.jpg',
  is_active: true,
  category: { id: 1, name: 'Electronics', description: null },
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = { isAuthenticated: false };
    mockAddItem.mockResolvedValue({});
  });

  describe('renders product info', () => {
    it('displays product name', () => {
      render(<ProductCard product={createMockProduct({ name: 'Awesome Widget' })} />);

      expect(screen.getByRole('heading', { name: 'Awesome Widget' })).toBeInTheDocument();
    });

    it('displays product description', () => {
      render(<ProductCard product={createMockProduct({ description: 'This is a description' })} />);

      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('displays product image when image_url is provided', () => {
      render(<ProductCard product={createMockProduct({ image_url: 'https://example.com/img.jpg' })} />);

      const image = screen.getByRole('img', { name: 'Test Product' });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/img.jpg');
    });

    it('displays placeholder when image_url is null', () => {
      render(<ProductCard product={createMockProduct({ image_url: null })} />);

      expect(screen.getByText('📦')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('displays stock count when in stock', () => {
      render(<ProductCard product={createMockProduct({ stock: 15 })} />);

      expect(screen.getByText('15 in stock')).toBeInTheDocument();
    });

    it('displays "Out of stock" when stock is 0', () => {
      render(<ProductCard product={createMockProduct({ stock: 0 })} />);

      expect(screen.getByText('Out of stock')).toBeInTheDocument();
    });

    it('displays Add to Cart button', () => {
      render(<ProductCard product={createMockProduct()} />);

      expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
    });
  });

  describe('displays price correctly', () => {
    it('formats price with two decimal places', () => {
      render(<ProductCard product={createMockProduct({ price: 29.99 })} />);

      expect(screen.getByText('$29.99')).toBeInTheDocument();
    });

    it('formats whole number price with two decimal places', () => {
      render(<ProductCard product={createMockProduct({ price: 50 })} />);

      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('formats price with many decimals correctly', () => {
      render(<ProductCard product={createMockProduct({ price: 19.999 })} />);

      expect(screen.getByText('$20.00')).toBeInTheDocument();
    });

    it('formats large price correctly', () => {
      render(<ProductCard product={createMockProduct({ price: 1234.56 })} />);

      expect(screen.getByText('$1234.56')).toBeInTheDocument();
    });
  });

  describe('handles add to cart', () => {
    it('shows login message when not authenticated', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = false;

      render(<ProductCard product={createMockProduct()} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      expect(screen.getByText('Please login to add items to cart')).toBeInTheDocument();
      expect(mockAddItem).not.toHaveBeenCalled();
    });

    it('calls cartApi.addItem when authenticated', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;

      render(<ProductCard product={createMockProduct({ id: 42 })} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      expect(mockAddItem).toHaveBeenCalledWith(42, 1);
    });

    it('shows "Adding..." while adding to cart', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;

      // Make addItem take time
      mockAddItem.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<ProductCard product={createMockProduct()} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      expect(screen.getByRole('button', { name: 'Adding...' })).toBeInTheDocument();
    });

    it('shows success message after adding to cart', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockResolvedValue({});

      render(<ProductCard product={createMockProduct()} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      await waitFor(() => {
        expect(screen.getByText('Added to cart!')).toBeInTheDocument();
      });
    });

    it('shows error message when add to cart fails', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockRejectedValue(new Error('Network error'));

      render(<ProductCard product={createMockProduct()} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to add to cart')).toBeInTheDocument();
      });
    });

    it('calls onAddToCart callback on success', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockResolvedValue({});
      const onAddToCart = vi.fn();

      render(<ProductCard product={createMockProduct()} onAddToCart={onAddToCart} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      await waitFor(() => {
        expect(onAddToCart).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onAddToCart callback on failure', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockRejectedValue(new Error('Network error'));
      const onAddToCart = vi.fn();

      render(<ProductCard product={createMockProduct()} onAddToCart={onAddToCart} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to add to cart')).toBeInTheDocument();
      });
      expect(onAddToCart).not.toHaveBeenCalled();
    });

    it('disables button while adding', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<ProductCard product={createMockProduct()} />);

      const button = screen.getByRole('button', { name: 'Add to Cart' });
      await user.click(button);

      expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
    });

    it('disables button when out of stock', () => {
      render(<ProductCard product={createMockProduct({ stock: 0 })} />);

      expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeDisabled();
    });

    it('clears message after timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockAuthState.isAuthenticated = true;
      mockAddItem.mockResolvedValue({});

      render(<ProductCard product={createMockProduct()} />);

      await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

      await waitFor(() => {
        expect(screen.getByText('Added to cart!')).toBeInTheDocument();
      });

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      await waitFor(() => {
        expect(screen.queryByText('Added to cart!')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });
});
