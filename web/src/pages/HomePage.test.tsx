import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { HomePage } from './HomePage';

afterEach(() => vi.unstubAllGlobals());

function renderHome() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  it('renders the translated title and tagline', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Abaqo' })).toBeInTheDocument();
    expect(
      screen.getByText('Tu presupuesto por sobres, con el buzón primero.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('status-skeleton')).toBeInTheDocument();
  });

  it('shows the ok status with text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))),
    );
    renderHome();
    expect(await screen.findByText('API operativa')).toBeInTheDocument();
  });

  it('shows the unreachable status with text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    renderHome();
    expect(await screen.findByText('API no disponible')).toBeInTheDocument();
  });
});
