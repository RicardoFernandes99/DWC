import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from './components/cart-page';
import { CART_STORAGE_KEY, saveCart } from './cart-storage';
import { currentUser, publicRequest } from '@/lib/session';

vi.mock('@/lib/session', async (original) => ({
  ...(await original<typeof import('@/lib/session')>()),
  currentUser: vi.fn(),
  publicRequest: vi.fn(),
}));

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: ReactNode; to?: string }) => (
    <a href={to ?? '#'}>{children}</a>
  ),
}));

const mockProductA = {
  id: '64b1f2e4c9e77a1b2c3d4e01',
  producerId: '64b1f2e4c9e77a1b2c3d4aaa',
  producerFarmName: 'Willow Brook Farm',
  producerCity: 'Bristol',
  name: 'Organic Tomatoes',
  description: 'Ripe red vine tomatoes',
  category: 'vegetables' as const,
  productionMethod: 'organic' as const,
  seasons: ['summer'] as const,
  priceCents: 350,
  unit: 'kg' as const,
  availableStock: 10,
  imageUrl: null,
};

const mockProductB = {
  id: '64b1f2e4c9e77a1b2c3d4e02',
  producerId: '64b1f2e4c9e77a1b2c3d4bbb',
  producerFarmName: 'Highland Dairy',
  producerCity: 'Bath',
  name: 'Farmhouse Butter',
  description: 'Salted cultured butter',
  category: 'dairy' as const,
  productionMethod: 'artisanal' as const,
  seasons: ['year_round'] as const,
  priceCents: 500,
  unit: 'unit' as const,
  availableStock: 5,
  imageUrl: null,
};

function renderCart(userRole?: 'buyer' | 'producer' | null) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const sessionUser = userRole
    ? {
        id: '1',
        name: userRole === 'buyer' ? 'Alice Buyer' : 'Bob Producer',
        email: `${userRole}@example.com`,
        role: userRole,
        producerStatus: userRole === 'producer' ? ('approved' as const) : null,
        buyerStatus: 'active' as const,
        buyerSuspensionReason: null,
        producerRejectionReason: null,
      }
    : null;

  vi.mocked(currentUser).mockResolvedValue(sessionUser);
  client.setQueryData(['session'], sessionUser);

  return render(
    <QueryClientProvider client={client}>
      <CartPage />
    </QueryClientProvider>,
  );
}

describe('Cart page interactions and multi-producer behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('displays empty cart state with browse link when cart has no items', async () => {
    vi.mocked(publicRequest).mockResolvedValue({ items: [] });
    renderCart(null);

    expect(
      screen.getByRole('heading', { name: 'Your cart is empty' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Explore freshly harvested/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Explore the Market/i }),
    ).toBeInTheDocument();
  });

  it('groups items by producer with producer subtotals and overall order summary', async () => {
    saveCart({
      version: 1,
      items: [
        {
          productId: mockProductA.id,
          quantity: 2,
          producerId: mockProductA.producerId,
          producerFarmName: mockProductA.producerFarmName,
          name: mockProductA.name,
          priceCents: mockProductA.priceCents,
          unit: mockProductA.unit,
        },
        {
          productId: mockProductB.id,
          quantity: 1,
          producerId: mockProductB.producerId,
          producerFarmName: mockProductB.producerFarmName,
          name: mockProductB.name,
          priceCents: mockProductB.priceCents,
          unit: mockProductB.unit,
        },
      ],
    });

    vi.mocked(publicRequest).mockImplementation((path) => {
      if (path === `products/${mockProductA.id}`) {
        return Promise.resolve(mockProductA);
      }
      if (path === `products/${mockProductB.id}`) {
        return Promise.resolve(mockProductB);
      }
      return Promise.resolve({ items: [] });
    });

    renderCart(null);

    // Both producers should be visible
    expect(await screen.findByText('Willow Brook Farm')).toBeInTheDocument();
    expect(screen.getByText('Highland Dairy')).toBeInTheDocument();

    // Products visible
    expect(screen.getByText('Organic Tomatoes')).toBeInTheDocument();
    expect(screen.getByText('Farmhouse Butter')).toBeInTheDocument();

    // Overall summary
    expect(
      screen.getByRole('heading', { name: 'Order Summary' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 items from 2 producers')).toBeInTheDocument();

    // Sign in prompt for guest
    expect(
      screen.getByRole('link', { name: /Sign in as buyer to check out/i }),
    ).toBeInTheDocument();
  });

  it('allows increasing, decreasing, and removing line items', async () => {
    saveCart({
      version: 1,
      items: [
        {
          productId: mockProductA.id,
          quantity: 2,
          producerId: mockProductA.producerId,
          producerFarmName: mockProductA.producerFarmName,
          name: mockProductA.name,
          priceCents: mockProductA.priceCents,
          unit: mockProductA.unit,
        },
      ],
    });

    vi.mocked(publicRequest).mockImplementation((path) => {
      if (path === `products/${mockProductA.id}`) {
        return Promise.resolve(mockProductA);
      }
      return Promise.resolve({ items: [] });
    });

    renderCart('buyer');

    expect(await screen.findByText('Organic Tomatoes')).toBeInTheDocument();

    // Increase quantity from 2 to 3
    const increaseBtn = screen.getByRole('button', {
      name: `Increase quantity of ${mockProductA.name}`,
    });
    fireEvent.click(increaseBtn);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}');
      expect(stored.items[0].quantity).toBe(3);
    });

    // Remove item
    const removeBtn = screen.getByRole('button', {
      name: `Remove ${mockProductA.name} from cart`,
    });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Your cart is empty' }),
      ).toBeInTheDocument();
    });
  });

  it('displays out of stock and unavailable warnings distinctly with clear guidance', async () => {
    saveCart({
      version: 1,
      items: [
        {
          productId: mockProductA.id,
          quantity: 2,
          name: mockProductA.name,
        },
      ],
    });

    // Mock API returning 0 available stock
    vi.mocked(publicRequest).mockResolvedValue({
      ...mockProductA,
      availableStock: 0,
    });

    renderCart('buyer');

    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Adjust or remove unavailable items before placing your order/i,
      ),
    ).toBeInTheDocument();
  });
});
