import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';

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
