/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
};

// Wrapper with router for Link component
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error for error boundary tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('when no error occurs', () => {
    it('renders children normally', () => {
      renderWithRouter(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('does not show error UI', () => {
      renderWithRouter(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('when an error occurs', () => {
    it('catches errors and displays fallback UI', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument();
    });

    it('displays Try Again button', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('displays Go Home link', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const homeLink = screen.getByRole('link', { name: 'Go Home' });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('logs error to console', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Find our specific log call (not React's internal error logs)
      const ourLogCall = consoleErrorSpy.mock.calls.find(
        call => call[0] === 'Error caught by boundary:'
      );
      expect(ourLogCall).toBeDefined();
    });
  });

  describe('error recovery', () => {
    it('resets state when Try Again is clicked', async () => {
      const user = userEvent.setup();

      // Use a stateful wrapper to control error throwing
      let shouldThrow = true;
      const ConditionalThrower = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Normal content</div>;
      };

      render(
        <MemoryRouter>
          <ErrorBoundary>
            <ConditionalThrower />
          </ErrorBoundary>
        </MemoryRouter>
      );

      // Error should be shown
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Simulate fixing the error condition before clicking retry
      shouldThrow = false;

      // Click Try Again - this should reset the boundary and re-render children
      await user.click(screen.getByRole('button', { name: 'Try Again' }));

      // Should show normal content now (error boundary state reset, component no longer throws)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('renders custom fallback when provided', () => {
      renderWithRouter(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('getDerivedStateFromError', () => {
    it('sets hasError to true when error occurs', () => {
      renderWithRouter(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // The presence of the alert role indicates hasError is true
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
