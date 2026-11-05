import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from './pages';
import { currentUser, logout } from './lib/session';
vi.mock('./lib/session', async (original) => ({
  ...(await original<typeof import('./lib/session')>()),
  currentUser: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/login">{children}</a>
  ),
}));
const person = {
  id: '1',
  name: 'Buyer',
  email: 'buyer@example.com',
  role: 'buyer' as const,
  producerStatus: null,
  buyerStatus: 'active' as const,
  buyerSuspensionReason: null,
  producerRejectionReason: null,
};
function showAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['session'], person);
  render(
    <QueryClientProvider client={client}>
      <Account />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
});
describe('account retry states', () => {
  it('keeps cached identity visible and offers a retry when refresh fails', async () => {
    vi.mocked(currentUser)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(person);
    showAccount();
    expect(
      await screen.findByText(/information shown may be out of date/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Buyer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await vi.waitFor(() =>
      expect(
        screen.queryByText(/information shown may be out of date/),
      ).not.toBeInTheDocument(),
    );
  });
  it('retries revocation without trying to restore the session', async () => {
    vi.mocked(currentUser).mockResolvedValue(person);
    vi.mocked(logout)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue();
    showAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry revocation' }),
    );
    await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
  });
});
