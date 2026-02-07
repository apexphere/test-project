import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import { Products } from '../../src/pages/Products';
import { server } from '../mocks/server';
import { errorHandlers, mockProducts } from '../mocks/handlers';

describe('Products Integration', () => {
  it('fetches and displays products from API', async () => {
    renderWithProviders(<Products />);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for products to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Verify all products are displayed
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText('Coffee Mug')).toBeInTheDocument();
    expect(screen.getByText('Laptop Stand')).toBeInTheDocument();
  });

  it('displays product prices correctly', async () => {
    renderWithProviders(<Products />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Check that prices are displayed
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('$14.99')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
  });

  it('filters products by search term', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'headphones');

    // Wait for filtered results
    await waitFor(() => {
      expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    });

    // Other products should not be visible after search filter
    await waitFor(() => {
      expect(screen.queryByText('Coffee Mug')).not.toBeInTheDocument();
    });
  });

  it('displays error message when API fails', async () => {
    // Override with error handler
    server.use(errorHandlers.productsError);

    renderWithProviders(<Products />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load products')).toBeInTheDocument();
    });
  });

  it('displays empty state when no products found', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Products />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Search for non-existent product
    const searchInput = screen.getByPlaceholderText('Search products...');
    await user.type(searchInput, 'xyznonexistent');

    await waitFor(() => {
      expect(screen.getByText('No products found')).toBeInTheDocument();
    });
  });
});
