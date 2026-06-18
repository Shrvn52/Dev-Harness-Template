import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Non-vacuous: renders the real App through real providers and asserts the
// load-bearing heading. (The items fetch fails under jsdom — fine, the heading
// renders independent of data.)
describe('App', () => {
  it('renders the Items heading', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: /items/i })).toBeInTheDocument();
  });
});
