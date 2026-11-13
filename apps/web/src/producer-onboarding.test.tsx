import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from './pages';
import {
  ApiError,
  authenticatedRequest,
  currentUser,
  type User,
} from './lib/session';

const SUSPENDED_PRODUCER_BANNER_COPY =
  'Your account is suspended until the issue is resolved. You cannot create new auctions or register new products.';

vi.mock('./lib/session', async (original) => ({
  ...(await original<typeof import('./lib/session')>()),
  currentUser: vi.fn(),
  authenticatedRequest: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  useLocation: (options?: {
    select?: (location: { pathname: string }) => unknown;
  }) => {
    const location = {
      pathname: window.location.pathname,
      search: {},
      hash: '',
    };
    return options?.select ? options.select(location) : location;
  },
  useParams: () => ({}),
  useSearch: () => ({}),
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/login">{children}</a>
  ),
}));

// The real search calls the geocoder; the stub lets a test pick a match.
vi.mock('@/components/shared/address-search', () => ({
  AddressSearch: ({
    id,
    value,
    onValueChange,
    onPick,
  }: {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    onPick: (match: {
      label: string;
      latitude: number;
      longitude: number;
      city: string | null;
    }) => void;
  }) => (
    <>
      <input
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() =>
          onPick({
            label: value,
            latitude: 38.8029,
            longitude: -9.3817,
            city: null,
          })
        }
      >
        Pick match
      </button>
    </>
  ),
}));

const baseProducer: User = {
  id: 'prod-1',
  name: 'Maria Costa',
  email: 'maria@example.com',
  role: 'producer',
  producerStatus: 'pending',
  buyerStatus: 'active' as const,
  buyerSuspensionReason: null,
  producerRejectionReason: null,
  avatarUrl: null,
};

const sampleApplication = {
  farmName: 'Quinta do Sol',
  description: 'Organic heirloom vegetables and citrus orchard in Sintra.',
  city: 'Sintra',
  collectionAddress: 'Rua Principal 12, 2710-001 Sintra',
  latitude: 38.8029,
  longitude: -9.3817,
};

function renderAccount(user: User = baseProducer) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['session'], user);
  render(
    <QueryClientProvider client={client}>
      <Account />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/producer');
});

describe('producer onboarding and status screens', () => {
  it('submits an initial pending application via PUT and refreshes status and session caches', async () => {
    const submittedResponse = {
      status: 'pending' as const,
      rejectionReason: null,
      submittedAt: '2026-11-01T14:30:00.000Z',
      application: sampleApplication,
    };

    vi.mocked(currentUser).mockResolvedValue(baseProducer);
    vi.mocked(authenticatedRequest)
      .mockResolvedValueOnce({
        status: 'pending',
        rejectionReason: null,
        submittedAt: null,
        application: null,
      })
      .mockResolvedValueOnce(submittedResponse)
      .mockResolvedValue(submittedResponse);

    renderAccount(baseProducer);

    expect(
      await screen.findByRole('heading', {
        name: 'Complete your producer application',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Application details are for producer verification/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  Quinta do Sol  ' },
    });
    fireEvent.change(screen.getByLabelText('City'), {
      target: { value: 'Sintra' },
    });
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'Rua Principal 12, 2710-001 Sintra' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pick match' }));
    fireEvent.change(screen.getByLabelText('Description'), {
      target: {
        value: 'Organic heirloom vegetables and citrus orchard in Sintra.',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await vi.waitFor(() => {
      expect(authenticatedRequest).toHaveBeenCalledWith(
        'producer/application',
        {
          method: 'PUT',
          body: JSON.stringify(sampleApplication),
        },
      );
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Submitted application details',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(sampleApplication.collectionAddress),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('displays rejection reason and resubmits via POST /resubmit to transition back to pending', async () => {
    const rejectedUser: User = {
      ...baseProducer,
      producerStatus: 'rejected',
      buyerStatus: 'active' as const,
      buyerSuspensionReason: null,
      producerRejectionReason:
        'Collection address is missing the street number and postal code.',
    };
    const rejectedResponse = {
      status: 'rejected' as const,
      rejectionReason:
        'Collection address is missing the street number and postal code.',
      submittedAt: '2026-11-01T10:00:00.000Z',
      application: {
        ...sampleApplication,
        collectionAddress: 'Rua Principal, Sintra',
      },
    };
    const resubmittedResponse = {
      status: 'pending' as const,
      rejectionReason: null,
      submittedAt: '2026-11-01T15:00:00.000Z',
      application: sampleApplication,
    };

    vi.mocked(currentUser)
      .mockResolvedValueOnce(rejectedUser)
      .mockResolvedValue({
        ...baseProducer,
        producerStatus: 'pending',
        buyerStatus: 'active' as const,
        buyerSuspensionReason: null,
        producerRejectionReason: null,
        avatarUrl: null,
      });
    vi.mocked(authenticatedRequest)
      .mockResolvedValueOnce(rejectedResponse)
      .mockResolvedValueOnce(resubmittedResponse)
      .mockResolvedValue(resubmittedResponse);

    renderAccount(rejectedUser);

    expect(
      await screen.findByRole('heading', { name: 'Application rejected' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Collection address is missing the street number and postal code.',
      ),
    ).toBeInTheDocument();

    const addressInput = screen.getByLabelText('Address') as HTMLInputElement;
    expect(addressInput.value).toBe('Rua Principal, Sintra');

    fireEvent.change(addressInput, {
      target: { value: sampleApplication.collectionAddress },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pick match' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Resubmit application' }),
    );

    await vi.waitFor(() => {
      expect(authenticatedRequest).toHaveBeenCalledWith(
        'producer/application/resubmit',
        {
          method: 'POST',
          body: JSON.stringify(sampleApplication),
        },
      );
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Submitted application details',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Application rejected' }),
    ).not.toBeInTheDocument();
  });

  it('shows the exact agreed suspension banner and preserves existing-order handling notice', async () => {
    const suspendedUser: User = {
      ...baseProducer,
      producerStatus: 'suspended',
    };
    vi.mocked(currentUser).mockResolvedValue(suspendedUser);
    vi.mocked(authenticatedRequest).mockResolvedValue({
      status: 'suspended',
      rejectionReason: null,
      submittedAt: '2026-11-01T09:00:00.000Z',
      application: sampleApplication,
    });

    renderAccount(suspendedUser);

    expect(
      await screen.findByText(SUSPENDED_PRODUCER_BANNER_COPY),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Existing orders can still be fulfilled/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Submit application/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Save application changes/i }),
    ).not.toBeInTheDocument();
  });

  it('preserves entered values on validation or network error and refreshes server state on a 409 Conflict race', async () => {
    vi.mocked(currentUser)
      .mockResolvedValueOnce(baseProducer)
      .mockResolvedValue({
        ...baseProducer,
        producerStatus: 'rejected',
        buyerStatus: 'active' as const,
        buyerSuspensionReason: null,
        producerRejectionReason: 'Please provide exact GPS coordinates.',
      });

    vi.mocked(authenticatedRequest)
      .mockResolvedValueOnce({
        status: 'pending',
        rejectionReason: null,
        submittedAt: '2026-11-01T11:00:00.000Z',
        application: sampleApplication,
      })
      .mockRejectedValueOnce(new ApiError(0, 'Could not connect.'))
      .mockRejectedValueOnce(
        new ApiError(
          409,
          'Only pending producer applications can be saved directly.',
        ),
      )
      .mockResolvedValue({
        status: 'rejected',
        rejectionReason: 'Please provide exact GPS coordinates.',
        submittedAt: '2026-11-01T11:00:00.000Z',
        application: sampleApplication,
      });

    renderAccount(baseProducer);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const farmInput = screen.getByLabelText('Name') as HTMLInputElement;
    const addressInput = screen.getByLabelText('Address') as HTMLInputElement;

    // 1. Client validation error preserves input and focuses invalid field:
    // editing the address text drops the pin until a match is picked.
    fireEvent.change(farmInput, {
      target: { value: 'Quinta da Serra Nova' },
    });
    fireEvent.change(addressInput, {
      target: { value: 'Rua Nova 3, Sintra' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save application changes' }),
    );

    expect(
      await screen.findByText(
        'Pick your address from the search results to place it on the map.',
      ),
    ).toBeInTheDocument();
    expect(farmInput.value).toBe('Quinta da Serra Nova');
    expect(document.activeElement).toBe(addressInput);

    // 2. Network error preserves user input
    fireEvent.click(screen.getByRole('button', { name: 'Pick match' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Save application changes' }),
    );
    expect(await screen.findByText('Could not connect.')).toBeInTheDocument();
    expect(farmInput.value).toBe('Quinta da Serra Nova');

    // 3. Stale 409 Conflict race refetches current status from the server
    fireEvent.click(
      screen.getByRole('button', { name: 'Save application changes' }),
    );

    expect(
      await screen.findByText(
        /Your producer status changed on the server while you were editing/i,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Application rejected' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Please provide exact GPS coordinates.'),
    ).toBeInTheDocument();
  });

  it('guards direct /producer/... creation sub-URLs for pending producers and never fetches producer application data for buyers', async () => {
    window.history.replaceState({}, '', '/producer/products/new');
    vi.mocked(currentUser).mockResolvedValue(baseProducer);
    vi.mocked(authenticatedRequest).mockResolvedValue({
      status: 'pending',
      rejectionReason: null,
      submittedAt: null,
      application: null,
    });

    const { unmount } = render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <Account />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(
        /Product registration and auction creation routes/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('/producer/products/new')).toBeInTheDocument();
    unmount();

    // Buyer visiting /producer does not trigger producer/application requests
    vi.clearAllMocks();
    const buyer: User = {
      id: 'buyer-1',
      name: 'João Buyer',
      email: 'joao@example.com',
      role: 'buyer',
      producerStatus: null,
      buyerStatus: 'active' as const,
      buyerSuspensionReason: null,
      producerRejectionReason: null,
      avatarUrl: null,
    };
    vi.mocked(currentUser).mockResolvedValue(buyer);
    vi.mocked(authenticatedRequest).mockResolvedValue([]);

    renderAccount(buyer);

    expect(
      await screen.findByRole('heading', { name: 'Payment methods' }),
    ).toBeInTheDocument();
    expect(authenticatedRequest).not.toHaveBeenCalledWith(
      'producer/application',
    );
    expect(
      screen.queryByRole('heading', { name: /Producer onboarding/i }),
    ).not.toBeInTheDocument();
  });
});
