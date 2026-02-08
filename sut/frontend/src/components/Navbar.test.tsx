/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
const mockLogout = vi.fn();
let mockAuthState = {
  user: null as { email: string; full_name: string | null } | null,
  isAuthenticated: false,
  logout: mockLogout,
};

vi.mock('../store/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

const renderNavbar = () => {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
};

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
    };
  });

  describe('renders correctly', () => {
    it('displays the brand logo and name', () => {
      renderNavbar();

      expect(screen.getByText('🛒 Mini Shop')).toBeInTheDocument();
    });

    it('displays the navigation toggle button', () => {
      renderNavbar();

      expect(screen.getByRole('button', { name: /toggle navigation/i })).toBeInTheDocument();
    });

    it('displays Products and Cart links', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Cart' })).toBeInTheDocument();
    });

    it('has correct href for brand link', () => {
      renderNavbar();

      const brandLink = screen.getByRole('link', { name: '🛒 Mini Shop' });
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('has correct href for Products link', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products');
    });

    it('has correct href for Cart link', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart');
    });
  });

  describe('shows/hides auth links based on login state', () => {
    it('shows Login and Register links when not authenticated', () => {
      mockAuthState.isAuthenticated = false;
      mockAuthState.user = null;

      renderNavbar();

      expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    });

    it('shows Orders link and Logout button when authenticated', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: 'Test User' };

      renderNavbar();

      expect(screen.getByRole('link', { name: 'Orders' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
    });

    it('displays user full_name when authenticated', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: 'John Doe' };

      renderNavbar();

      expect(screen.getByText('Hi, John Doe')).toBeInTheDocument();
    });

    it('displays user email when full_name is null', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: null };

      renderNavbar();

      expect(screen.getByText('Hi, test@example.com')).toBeInTheDocument();
    });

    it('has correct href for Login link', () => {
      mockAuthState.isAuthenticated = false;
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    });

    it('has correct href for Register link', () => {
      mockAuthState.isAuthenticated = false;
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    });

    it('has correct href for Orders link', () => {
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: 'Test User' };
      renderNavbar();

      expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/orders');
    });
  });

  describe('navigation and menu toggle', () => {
    it('toggles menu open state when toggle button is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();

      const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });

      // Initially shows hamburger icon
      expect(toggleButton).toHaveTextContent('☰');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      // Click to open
      await user.click(toggleButton);
      expect(toggleButton).toHaveTextContent('✕');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Click to close
      await user.click(toggleButton);
      expect(toggleButton).toHaveTextContent('☰');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('adds "open" class to navbar-links when menu is open', async () => {
      const user = userEvent.setup();
      renderNavbar();

      const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });
      const navLinks = document.querySelector('.navbar-links');

      expect(navLinks).not.toHaveClass('open');

      await user.click(toggleButton);
      expect(navLinks).toHaveClass('open');
    });

    it('closes menu when a navigation link is clicked', async () => {
      const user = userEvent.setup();
      renderNavbar();

      const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });

      // Open menu
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Click Products link
      await user.click(screen.getByRole('link', { name: 'Products' }));
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('logout functionality', () => {
    it('calls logout and navigates to home when Logout is clicked', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: 'Test User' };

      renderNavbar();

      await user.click(screen.getByRole('button', { name: 'Logout' }));

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('closes menu after logout', async () => {
      const user = userEvent.setup();
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { email: 'test@example.com', full_name: 'Test User' };

      renderNavbar();

      const toggleButton = screen.getByRole('button', { name: /toggle navigation/i });

      // Open menu first
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Click logout
      await user.click(screen.getByRole('button', { name: 'Logout' }));

      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
