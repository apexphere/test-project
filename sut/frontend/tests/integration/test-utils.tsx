import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/store/AuthContext';

interface WrapperProps {
  children: ReactNode;
}

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// Wrapper for tests that need routing
export function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Wrapper with MemoryRouter for controlled navigation
export function createMemoryRouterWrapper(initialEntries = ['/']) {
  return function MemoryRouterWrapper({ children }: WrapperProps) {
    const queryClient = createTestQueryClient();
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

// Custom render with all providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Render with memory router for specific routes
export function renderWithMemoryRouter(
  ui: React.ReactElement,
  initialEntries = ['/'],
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: createMemoryRouterWrapper(initialEntries),
    ...options,
  });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
