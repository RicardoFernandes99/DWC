import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  PackageCheck,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { formatMoney } from '@/lib/format';
import { ApiError, authenticatedRequest, currentUser } from '@/lib/session';
import type { components } from '@/lib/api-schema';
import { useCart } from '@/features/cart/use-cart';
import { EmptyState } from '@/components/shared/empty-state';

type FulfilmentMethod = 'delivery' | 'collection';
type DeliveryAddress = components['schemas']['DeliveryAddressDto'];
type CheckoutQuoteResponse = components['schemas']['CheckoutQuoteResponseDto'];
type CheckoutResponse = components['schemas']['CheckoutResponseDto'];
type PaymentMethod = components['schemas']['PaymentMethodResponseDto'];
type CreatePaymentMethod = components['schemas']['CreatePaymentMethodDto'];
type CheckoutPriceChangedConflict =
  components['schemas']['CheckoutPriceChangedConflictDto'];
type CheckoutQuoteIssue = components['schemas']['CheckoutQuoteIssueDto'];

const SAVED_ADDRESS_KEY = 'dwc_saved_delivery_address_v1';

function getStoredAddress(): Partial<DeliveryAddress> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(SAVED_ADDRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredAddress(address: DeliveryAddress): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(address));
  } catch {
    // ignore
  }
}

function currentUtcMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function isMethodExpired(method: PaymentMethod): boolean {
  const now = currentUtcMonth();
  return (
    method.expiryYear < now.year ||
    (method.expiryYear === now.year && method.expiryMonth < now.month)
  );
}

export function CheckoutPage() {
  const queryClient = useQueryClient();
  const { items, removeItems } = useCart();

  const userQuery = useQuery({
    queryKey: ['session'],
    queryFn: currentUser,
  });
  const user = userQuery.data;
  const buyerSuspended =
    user?.role === 'buyer' && user.buyerStatus === 'suspended';

  // Stored / Form Address
  const [fulfilmentMethod, setFulfilmentMethod] =
    useState<FulfilmentMethod>('delivery');
  const [address, setAddress] = useState<DeliveryAddress>(() => {
    const stored = getStoredAddress();
    return {
      recipientName: stored.recipientName ?? '',
      street: stored.street ?? '',
      city: stored.city ?? '',
      postalCode: stored.postalCode ?? '',
      country: stored.country ?? 'Portugal',
      notes: stored.notes ?? '',
    };
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>(
    {},
  );

  // Payment Selection state (derived defaults without setState in effect)
  const [userSelectedPaymentMode, setUserSelectedPaymentMode] = useState<
    'saved' | 'new' | null
  >(null);
  const [userSelectedMethodId, setUserSelectedMethodId] = useState<
    string | null
  >(null);
  const [newCard, setNewCard] = useState({
    number: '',
    month: '',
    year: '',
  });
  const [cardError, setCardError] = useState('');
  const [expiryError, setExpiryError] = useState('');

  // Submission state & Idempotency
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceChangedNotice, setPriceChangedNotice] = useState<string | null>(
    null,
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<CheckoutQuoteIssue[]>([]);
  const [completedCheckout, setCompletedCheckout] =
    useState<CheckoutResponse | null>(null);

  // Payment methods query
  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods', user?.id],
    queryFn: () => authenticatedRequest<PaymentMethod[]>('payment-methods'),
    enabled: Boolean(user && user.role === 'buyer'),
    retry: false,
  });

  const availableMethods = useMemo(() => {
    return (paymentMethodsQuery.data ?? []).filter((m) => !isMethodExpired(m));
  }, [paymentMethodsQuery.data]);

  const paymentMode =
    userSelectedPaymentMode ?? (availableMethods.length > 0 ? 'saved' : 'new');

  const selectedMethodId =
    userSelectedMethodId &&
    availableMethods.some((m) => m.id === userSelectedMethodId)
      ? userSelectedMethodId
      : (availableMethods[0]?.id ?? '');

  // Effective recipient name falls back to user's name if not typed
  const effectiveRecipientName =
    address.recipientName.trim() || user?.name || '';

  // Address validation check
  const isAddressComplete =
    fulfilmentMethod === 'collection' ||
    Boolean(
      effectiveRecipientName.trim() &&
      address.street.trim() &&
      address.city.trim() &&
      address.postalCode.trim(),
    );

  // Quote query
  const quoteQuery = useQuery({
    queryKey: [
      'checkout-quote',
      items.map((i) => `${i.productId}:${i.quantity}`).join(','),
      fulfilmentMethod,
      fulfilmentMethod === 'delivery'
        ? `${effectiveRecipientName}|${address.street.trim()}|${address.city.trim()}|${address.postalCode.trim()}`
        : 'collection',
    ],
    queryFn: () => {
      return authenticatedRequest<CheckoutQuoteResponse>('checkout/quote', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          fulfilmentMethod,
          deliveryAddress:
            fulfilmentMethod === 'delivery'
              ? {
                  recipientName: effectiveRecipientName.trim(),
                  street: address.street.trim(),
                  city: address.city.trim(),
                  postalCode: address.postalCode.trim(),
                  country: address.country?.trim() || 'Portugal',
                  notes: address.notes?.trim() || '',
                }
              : undefined,
        }),
      });
    },
    enabled:
      Boolean(user && user.role === 'buyer') &&
      items.length > 0 &&
      isAddressComplete,
    staleTime: 10_000,
    retry: false,
  });

  const quote = quoteQuery.data;

  // Combine line issues from quote and submission error
  const allIssuesMap = useMemo(() => {
    const map = new Map<string, CheckoutQuoteIssue>();
    for (const issue of quote?.issues ?? []) {
      map.set(issue.productId, issue);
    }
    for (const issue of serverIssues) {
      map.set(issue.productId, issue);
    }
    return map;
  }, [quote?.issues, serverIssues]);

  const hasIssues = allIssuesMap.size > 0 || (quote && !quote.isOrderable);

  // Handle Delivery Address Input
  const handleAddressChange = (field: keyof DeliveryAddress, value: string) => {
    setAddress((prev) => {
      const next = { ...prev, [field]: value };
      if (
        (next.recipientName.trim() || user?.name) &&
        next.street.trim() &&
        next.city.trim() &&
        next.postalCode.trim()
      ) {
        saveStoredAddress({
          ...next,
          recipientName: next.recipientName.trim() || (user?.name ?? ''),
        });
      }
      return next;
    });
    setAddressErrors((prev) => {
      if (prev[field]) {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      }
      return prev;
    });
  };

  // Submit checkout
  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    setPriceChangedNotice(null);
    setServerIssues([]);

    if (!user || user.role !== 'buyer') {
      setSubmissionError('You must be signed in as a buyer to check out.');
      return;
    }

    if (items.length === 0) {
      setSubmissionError('Your cart is empty.');
      return;
    }

    // Validate Address if delivery
    if (fulfilmentMethod === 'delivery') {
      const errors: Record<string, string> = {};
      if (!effectiveRecipientName.trim())
        errors.recipientName = 'Recipient name is required.';
      if (!address.street.trim()) errors.street = 'Street address is required.';
      if (!address.city.trim()) errors.city = 'City is required.';
      if (!address.postalCode.trim())
        errors.postalCode = 'Postal code is required.';

      if (Object.keys(errors).length > 0) {
        setAddressErrors(errors);
        setSubmissionError(
          'Please complete all required delivery address fields.',
        );
        return;
      }
      saveStoredAddress({
        ...address,
        recipientName: effectiveRecipientName.trim(),
      });
    }

    if (!quote) {
      setSubmissionError(
        'Unable to calculate order quote. Please check your address and item availability.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let paymentMethodId = selectedMethodId;

      // Handle New Card Entry
      if (paymentMode === 'new') {
        setCardError('');
        setExpiryError('');
        const digits = newCard.number.replaceAll(' ', '');
        if (!/^\d{4,19}$/.test(digits)) {
          setCardError('Enter at least 4 digits for your card number.');
          setIsSubmitting(false);
          return;
        }
        const month = Number(newCard.month);
        const year = Number(newCard.year);
        const now = currentUtcMonth();
        if (
          !/^\d{1,2}$/.test(newCard.month) ||
          month < 1 ||
          month > 12 ||
          !/^\d{4}$/.test(newCard.year) ||
          year < now.year ||
          (year === now.year && month < now.month)
        ) {
          setExpiryError(
            'Enter a valid expiry month and year that has not passed.',
          );
          setIsSubmitting(false);
          return;
        }

        // Save payment method via 005 API
        const createdMethod = await authenticatedRequest<PaymentMethod>(
          'payment-methods',
          {
            method: 'POST',
            body: JSON.stringify({
              last4: digits.slice(-4),
              expiryMonth: month,
              expiryYear: year,
            } satisfies CreatePaymentMethod),
          },
        );

        paymentMethodId = createdMethod.id;
        void queryClient.invalidateQueries({
          queryKey: ['payment-methods', user.id],
        });
      }

      if (!paymentMethodId) {
        setSubmissionError('Please select or add a valid payment method.');
        setIsSubmitting(false);
        return;
      }

      // Submit atomic checkout
      const response = await authenticatedRequest<CheckoutResponse>(
        'checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
            fulfilmentMethod,
            deliveryAddress:
              fulfilmentMethod === 'delivery'
                ? {
                    recipientName: effectiveRecipientName.trim(),
                    street: address.street.trim(),
                    city: address.city.trim(),
                    postalCode: address.postalCode.trim(),
                    country: address.country?.trim() || 'Portugal',
                    notes: address.notes?.trim() || '',
                  }
                : undefined,
            fingerprint: quote.fingerprint,
            paymentMethodId,
            idempotencyKey,
          }),
        },
      );

      // On Success: clear purchased items from cart and show confirmation
      removeItems(items.map((i) => i.productId));
      setCompletedCheckout(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const conflict = err.data as CheckoutPriceChangedConflict | undefined;
          setPriceChangedNotice(
            conflict?.message ??
              'Pricing, availability or fees have changed since the quote was generated. Totals have been updated below. Please review and confirm your order.',
          );
          void queryClient.invalidateQueries({
            queryKey: ['checkout-quote'],
          });
        } else if (err.status === 400) {
          const badRequest = err.data as
            { message?: string; issues?: CheckoutQuoteIssue[] } | undefined;
          setSubmissionError(
            badRequest?.message ??
              'One or more items in the cart are no longer available in the requested quantity.',
          );
          if (Array.isArray(badRequest?.issues)) {
            setServerIssues(badRequest.issues);
          }
          void queryClient.invalidateQueries({
            queryKey: ['checkout-quote'],
          });
        } else {
          setSubmissionError(
            err.message || 'Failed to complete checkout. Please try again.',
          );
        }
      } else {
        setSubmissionError(
          'An unexpected error occurred while placing your order. Please try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (completedCheckout) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-8 xl:py-14">
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border bg-card p-6 shadow-2xs sm:p-10"
        >
          <div className="flex flex-col items-center text-center">
            <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 aria-hidden="true" className="size-10 stroke-[2]" />
            </div>
            <h1 className="mt-4 font-editorial text-3xl font-bold tracking-tight md:text-4xl text-foreground">
              Thank you for your order!
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              Your payment has been processed successfully. A distinct order has
              been created and sent to each local producer:
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Orders created ({completedCheckout.orders.length})
            </h2>

            <div className="divide-y divide-border rounded-lg border bg-background/50">
              {completedCheckout.orders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`confirmed-order-${ord.orderId}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Store
                        aria-hidden="true"
                        className="size-4 text-primary shrink-0"
                      />
                      <span className="font-editorial text-base font-semibold">
                        {ord.producerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Order #{ord.orderId.slice(-8).toUpperCase()}</span>
                      <span>·</span>
                      <span>
                        {ord.itemCount} {ord.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      Pending producer confirmation
                    </span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {formatMoney(ord.totalCents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-lg border bg-muted/30 p-5 text-sm space-y-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Fulfilment method</span>
              <span className="font-medium text-foreground capitalize">
                {completedCheckout.fulfilmentMethod === 'delivery'
                  ? 'Delivery to address'
                  : 'Direct collection'}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Items subtotal</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatMoney(completedCheckout.subtotalCents)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery fees</span>
              <span className="tabular-nums font-medium text-foreground">
                {completedCheckout.deliveryFeeCents > 0
                  ? formatMoney(completedCheckout.deliveryFeeCents)
                  : 'Free'}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between text-base font-semibold text-foreground">
              <span>Total charged</span>
              <span className="tabular-nums">
                {formatMoney(completedCheckout.totalCents)}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button asChild variant="outline" className="rounded-md">
              <Link to="/products">Continue shopping</Link>
            </Button>
            <Button asChild className="rounded-md">
              <Link to="/account">View order history</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Access is resolved by the shared route guard.
  if (!user || user.role !== 'buyer') return null;

  // EMPTY CART
  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          size="page"
          headingLevel="h1"
          icon={<ShoppingBag />}
          title="Your cart is empty"
          description="Browse fresh, seasonal produce from local farmers to begin your order."
          action={
            <Button asChild>
              <Link to="/products">Explore the market</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 md:py-10 xl:px-12">
      {/* Navigation & Header */}
      <div className="mb-6">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to Cart
        </Link>
        <h1 className="mt-2 font-editorial text-3xl font-bold tracking-tight md:text-4xl text-foreground">
          Review & Checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your order with one fulfilment selection and card payment.
        </p>
      </div>

      {buyerSuspended && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm"
        >
          <p className="font-semibold">Purchases are paused for this account</p>
          <p className="mt-1">
            Your cart is saved. You can still manage saved cards and existing
            orders.
          </p>
        </div>
      )}

      {/* Notifications */}
      {priceChangedNotice && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm text-warning-foreground"
        >
          <AlertCircle
            aria-hidden="true"
            className="size-5 shrink-0 text-warning"
          />
          <div className="flex-1">
            <p className="font-semibold">Order totals updated</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {priceChangedNotice}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPriceChangedNotice(null)}
            className="text-xs shrink-0 rounded-md"
          >
            Acknowledge
          </Button>
        </div>
      )}

      {submissionError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle aria-hidden="true" className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Could not complete order</p>
            <p className="mt-0.5 text-xs opacity-90">{submissionError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmitCheckout}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* LEFT COLUMN: Fulfilment, Address, Payment */}
          <div className="space-y-8">
            {/* 1. Fulfilment Selection */}
            <section
              aria-labelledby="fulfilment-heading"
              className="rounded-lg border bg-card p-5 shadow-2xs sm:p-6"
            >
              <h2
                id="fulfilment-heading"
                className="font-editorial text-xl font-semibold text-foreground"
              >
                1. Fulfilment Method
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose how you wish to receive produce from all participating
                farms.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    fulfilmentMethod === 'delivery'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfilment"
                    value="delivery"
                    checked={fulfilmentMethod === 'delivery'}
                    onChange={() => setFulfilmentMethod('delivery')}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Truck aria-hidden="true" className="size-4" />
                      <span>Direct Delivery</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dispatched to your address. €5.00 delivery fee per
                      producer (free for orders €50+).
                    </p>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    fulfilmentMethod === 'collection'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfilment"
                    value="collection"
                    checked={fulfilmentMethod === 'collection'}
                    onChange={() => setFulfilmentMethod('collection')}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Store aria-hidden="true" className="size-4" />
                      <span>Farm Collection</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pick up directly from each producer location. Free of
                      charge.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* 2. Delivery Address (Visible when delivery chosen) */}
            {fulfilmentMethod === 'delivery' && (
              <section
                aria-labelledby="address-heading"
                className="rounded-lg border bg-card p-5 shadow-2xs sm:p-6"
              >
                <h2
                  id="address-heading"
                  className="font-editorial text-xl font-semibold text-foreground"
                >
                  2. Delivery Address
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Where should local producers deliver your order?
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField
                      id="recipientName"
                      label="Recipient Full Name"
                      error={addressErrors.recipientName}
                    >
                      <Input
                        id="recipientName"
                        value={address.recipientName}
                        onChange={(e) =>
                          handleAddressChange('recipientName', e.target.value)
                        }
                        placeholder={user?.name || 'e.g. Maria Silva'}
                        autoComplete="name"
                        className="rounded-md"
                        required
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField
                      id="street"
                      label="Street Address"
                      error={addressErrors.street}
                    >
                      <Input
                        id="street"
                        value={address.street}
                        onChange={(e) =>
                          handleAddressChange('street', e.target.value)
                        }
                        placeholder="e.g. Rua das Flores 123, 2º Dto"
                        autoComplete="street-address"
                        className="rounded-md"
                        required
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField
                      id="city"
                      label="City / Municipality"
                      error={addressErrors.city}
                    >
                      <Input
                        id="city"
                        value={address.city}
                        onChange={(e) =>
                          handleAddressChange('city', e.target.value)
                        }
                        placeholder="e.g. Porto"
                        autoComplete="address-level2"
                        className="rounded-md"
                        required
                      />
                    </FormField>
                  </div>

                  <div>
                    <FormField
                      id="postalCode"
                      label="Postal Code"
                      error={addressErrors.postalCode}
                    >
                      <Input
                        id="postalCode"
                        value={address.postalCode}
                        onChange={(e) =>
                          handleAddressChange('postalCode', e.target.value)
                        }
                        placeholder="e.g. 4000-001"
                        autoComplete="postal-code"
                        className="rounded-md"
                        required
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField
                      id="deliveryNotes"
                      label="Delivery Notes (Optional)"
                      description="Gate codes, doorbells, or delivery instructions for drivers."
                    >
                      <Input
                        id="deliveryNotes"
                        value={address.notes ?? ''}
                        onChange={(e) =>
                          handleAddressChange('notes', e.target.value)
                        }
                        placeholder="e.g. Leave with building concierge"
                        className="rounded-md"
                      />
                    </FormField>
                  </div>
                </div>
              </section>
            )}

            {/* 3. Payment Method */}
            <section
              aria-labelledby="payment-heading"
              className="rounded-lg border bg-card p-5 shadow-2xs sm:p-6"
            >
              <h2
                id="payment-heading"
                className="font-editorial text-xl font-semibold text-foreground"
              >
                {fulfilmentMethod === 'delivery' ? '3.' : '2.'} Payment Details
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay securely with credit or debit card.
              </p>

              {/* Saved Cards */}
              {availableMethods.length > 0 && (
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-medium text-foreground">
                    Saved payment methods
                  </span>
                  <div className="grid gap-2">
                    {availableMethods.map((method) => {
                      const isSelected =
                        paymentMode === 'saved' &&
                        selectedMethodId === method.id;
                      return (
                        <label
                          key={method.id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="paymentChoice"
                              value={method.id}
                              checked={isSelected}
                              onChange={() => {
                                setUserSelectedPaymentMode('saved');
                                setUserSelectedMethodId(method.id);
                              }}
                              className="size-4 accent-primary"
                            />
                            <div className="flex items-center gap-2">
                              <CreditCard
                                aria-hidden="true"
                                className="size-4 text-muted-foreground"
                              />
                              <span className="font-mono text-sm">
                                •••• •••• •••• {method.last4}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Expires{' '}
                            {method.expiryMonth.toString().padStart(2, '0')}/
                            {method.expiryYear}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Toggle to add new card */}
              <div className="mt-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="radio"
                    name="paymentChoice"
                    value="new"
                    checked={paymentMode === 'new'}
                    onChange={() => setUserSelectedPaymentMode('new')}
                    className="size-4 accent-primary"
                  />
                  <span>Use a new debit or credit card</span>
                </label>
              </div>

              {/* New Card Fields */}
              {paymentMode === 'new' && (
                <div className="mt-4 rounded-lg border bg-muted/20 p-4 space-y-4">
                  <FormField
                    id="newCardNumber"
                    label="Card Number"
                    error={cardError}
                  >
                    <div className="relative">
                      <Input
                        id="newCardNumber"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="4242 •••• •••• 4242"
                        value={newCard.number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d\s]/g, '');
                          setNewCard((prev) => ({ ...prev, number: val }));
                          if (cardError) setCardError('');
                        }}
                        className="pr-10 rounded-md font-mono"
                      />
                      <CreditCard
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-2.5 size-5 text-muted-foreground"
                      />
                    </div>
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      id="newCardMonth"
                      label="Expiry Month"
                      error={expiryError}
                    >
                      <Input
                        id="newCardMonth"
                        type="text"
                        inputMode="numeric"
                        placeholder="MM (e.g. 12)"
                        maxLength={2}
                        value={newCard.month}
                        onChange={(e) => {
                          setNewCard((prev) => ({
                            ...prev,
                            month: e.target.value.replace(/\D/g, ''),
                          }));
                          if (expiryError) setExpiryError('');
                        }}
                        className="rounded-md"
                      />
                    </FormField>

                    <FormField
                      id="newCardYear"
                      label="Expiry Year"
                      error={expiryError}
                    >
                      <Input
                        id="newCardYear"
                        type="text"
                        inputMode="numeric"
                        placeholder="YYYY (e.g. 2028)"
                        maxLength={4}
                        value={newCard.year}
                        onChange={(e) => {
                          setNewCard((prev) => ({
                            ...prev,
                            year: e.target.value.replace(/\D/g, ''),
                          }));
                          if (expiryError) setExpiryError('');
                        }}
                        className="rounded-md"
                      />
                    </FormField>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Your card will be saved securely for future farm orders. No
                    card security code (CVV) is stored.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: Order Review Summary Sticky */}
          <aside aria-labelledby="order-summary-title">
            <div className="sticky top-6 rounded-lg border bg-card p-5 shadow-2xs sm:p-6 space-y-6">
              <h2
                id="order-summary-title"
                className="font-editorial text-xl font-semibold text-foreground"
              >
                Order Summary
              </h2>

              {/* Producer Breakdown */}
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {quote ? (
                  quote.groups.map((group) => (
                    <div
                      key={group.producerId}
                      className="rounded-lg border bg-background/60 p-3.5 space-y-2.5 text-xs"
                      data-testid={`checkout-producer-group-${group.producerId}`}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                          <Store
                            aria-hidden="true"
                            className="size-3.5 text-primary shrink-0"
                          />
                          <span className="font-editorial text-sm font-semibold truncate">
                            {group.producerName}
                          </span>
                        </div>
                        {group.collectionAddress ? (
                          <span className="text-muted-foreground shrink-0">
                            Collection point
                          </span>
                        ) : null}
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 border-t pt-2">
                        {group.items.map((line) => {
                          const issue = allIssuesMap.get(line.productId);
                          return (
                            <div
                              key={line.productId}
                              className={`rounded p-1.5 ${
                                issue
                                  ? 'border border-destructive/40 bg-destructive/5'
                                  : ''
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="line-clamp-1 font-medium">
                                  {line.quantity}× {line.productName}
                                </span>
                                <span className="tabular-nums font-semibold shrink-0">
                                  {formatMoney(line.lineTotalCents)}
                                </span>
                              </div>

                              {issue && (
                                <p
                                  role="alert"
                                  className="mt-1 text-[11px] font-semibold text-destructive flex items-center gap-1"
                                >
                                  <AlertCircle
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                  {issue.code === 'insufficient_stock'
                                    ? 'Insufficient stock'
                                    : 'Out of stock'}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Producer subtotal & delivery fee */}
                      <div className="border-t pt-2 space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="tabular-nums text-foreground">
                            {formatMoney(group.subtotalCents)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Delivery</span>
                          <span className="tabular-nums text-foreground">
                            {group.deliveryFeeCents > 0
                              ? formatMoney(group.deliveryFeeCents)
                              : 'Free'}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/40">
                          <span>Producer total</span>
                          <span className="tabular-nums">
                            {formatMoney(group.totalCents)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex justify-between text-xs"
                      >
                        <span className="truncate">
                          {item.quantity}× {item.name ?? 'Item'}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatMoney((item.priceCents ?? 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                    {!isAddressComplete && fulfilmentMethod === 'delivery' && (
                      <p className="text-xs text-muted-foreground italic">
                        Enter delivery address to calculate fees.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Combined Totals */}
              <dl className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Items Subtotal</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {formatMoney(quote?.subtotalCents ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Delivery</dt>
                  <dd className="tabular-nums font-medium text-foreground">
                    {fulfilmentMethod === 'collection'
                      ? 'Free (Collection)'
                      : (quote?.deliveryFeeCents ?? 0) > 0
                        ? formatMoney(quote?.deliveryFeeCents ?? 0)
                        : 'Free'}
                  </dd>
                </div>
                <div className="border-t pt-3 flex justify-between text-base font-semibold text-foreground">
                  <dt>Total to pay</dt>
                  <dd className="tabular-nums">
                    {formatMoney(quote?.totalCents ?? 0)}
                  </dd>
                </div>
              </dl>

              {/* Submit CTA */}
              <div className="space-y-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isSubmitting ||
                    quoteQuery.isPending ||
                    !quote ||
                    buyerSuspended ||
                    hasIssues ||
                    !isAddressComplete
                  }
                  className="w-full rounded-md font-medium"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Processing order...
                    </span>
                  ) : buyerSuspended ? (
                    'Purchases paused'
                  ) : hasIssues ? (
                    'Unavailable items in cart'
                  ) : !isAddressComplete && fulfilmentMethod === 'delivery' ? (
                    'Enter delivery address'
                  ) : (
                    `Place Order • ${formatMoney(quote?.totalCents ?? 0)}`
                  )}
                </Button>

                {hasIssues && (
                  <p className="text-center text-xs text-destructive font-medium">
                    Please return to your cart to adjust unavailable items.
                  </p>
                )}

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <PackageCheck aria-hidden="true" className="size-3.5" />
                  <span>Atomic order placement · Direct from farmers</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}
