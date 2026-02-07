import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMemoryRouter } from './test-utils';
import { Login } from '../../src/pages/Login';
import { server } from '../mocks/server';
import { errorHandlers } from '../mocks/handlers';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Auth Integration', () => {
  it('allows user to login with valid credentials', async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter(<Login />, ['/login']);

    // Fill in login form
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');

    // Submit form
    await user.click(screen.getByRole('button', { name: 'Login' }));

    // Wait for login to complete
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // Token should be stored
    expect(localStorage.getItem('token')).toBe('mock-jwt-token');
  });

  it('displays error for invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter(<Login />, ['/login']);

    // Fill in with wrong credentials
    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');

    // Submit form
    await user.click(screen.getByRole('button', { name: 'Login' }));

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Token should not be stored
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    renderWithMemoryRouter(<Login />, ['/login']);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');

    // Click login and check loading state immediately
    await user.click(screen.getByRole('button', { name: 'Login' }));

    // Button should show loading state
    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled();
  });

  it('displays error when login service is unavailable', async () => {
    server.use(errorHandlers.loginError);

    const user = userEvent.setup();
    renderWithMemoryRouter(<Login />, ['/login']);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  it('has link to registration page', async () => {
    renderWithMemoryRouter(<Login />, ['/login']);

    const registerLink = screen.getByRole('link', { name: 'Register' });
    expect(registerLink).toHaveAttribute('href', '/register');
  });
});
