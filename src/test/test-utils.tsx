import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';

// Test wrapper with providers
function TestWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// Custom render function with providers
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with our custom version
export { customRender as render };
