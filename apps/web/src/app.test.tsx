import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/ui-design">{children}</a>
  ),
}));

describe('service connection', () => {
  it('checks the API and displays verified readiness', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
    vi.stubGlobal('fetch', fetch);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(
      await screen.findByText('API, database, and storage are available.'),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/health/ready',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports a failed API request and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(
      await screen.findByText(
        'Could not connect to the services. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check connection' }),
    ).toBeEnabled();
  });
});
