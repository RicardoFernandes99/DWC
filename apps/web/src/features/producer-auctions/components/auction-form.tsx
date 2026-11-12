import { useRef, useState } from 'react';
import { DateTimePicker } from '@/components/shared/date-time-picker';
import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import type { components } from '@/lib/api-schema';
import { formatUnit } from '@/lib/format';
import { ApiError, authenticatedRequest } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import {
  auctionKey,
  auctionListKey,
  fetchAuction,
  fetchProducerProduct,
  fetchProducerProducts,
  producerProductKey,
  producerProductListKey,
  type Auction,
} from './auction-data';
import { useAuctionBeforeStart } from './use-auction-before-start';
import { EmptyState } from '@/components/shared/empty-state';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  PackagePlus,
} from 'lucide-react';

type CreateAuction = components['schemas']['CreateAuctionDto'];
type UpdateAuction = components['schemas']['UpdateAuctionDto'];
type AuctionChanges = Omit<UpdateAuction, 'revision'>;
type AuctionFieldName =
  | 'productId'
  | 'quantity'
  | 'startingPrice'
  | 'increment'
  | 'startsAt'
  | 'endsAt';

function fieldDescriptionIds(id: string, hasError: boolean) {
  return `${id}-description${hasError ? ` ${id}-error` : ''}`;
}

function asLocalDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

function localToIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function errorMessage(error: unknown, action: string) {
  if (error instanceof ApiError && error.status === 409)
    return `The auction or product stock changed before you could ${action}. No changes were saved. Reload the current server values before trying again.`;
  if (error instanceof ApiError && error.status === 403)
    return 'Your producer account is not currently approved to create or edit auctions.';
  if (error instanceof ApiError && error.status === 400)
    return 'The server rejected these values. Check the quantity, prices and dates.';
  return error instanceof Error
    ? error.message
    : `Could not ${action}. Please try again.`;
}

const DISCARD_MESSAGE = 'Discard your unsaved changes?';

function BackToAuctions({ onClick }: { onClick?: () => void }) {
  const className =
    'inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground';
  const content = (
    <>
      <ArrowLeft aria-hidden="true" className="size-4" /> Back to auctions
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <Link to="/producer/auctions" className={className}>
      {content}
    </Link>
  );
}

export function AuctionForm({
  auction,
  writable = true,
}: {
  auction?: Auction;
  writable?: boolean;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [baseAuction, setBaseAuction] = useState(auction);
  const productsQuery = useQuery({
    queryKey: producerProductListKey,
    queryFn: fetchProducerProducts,
    enabled: !baseAuction,
    staleTime: 0,
  });
  const [chosenProductId, setChosenProductId] = useState(
    auction?.productId ?? '',
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AuctionFieldName, string>>
  >({});
  const [stockNote, setStockNote] = useState('');
  // Set once the user has chosen to leave (or saved), so the guard steps aside.
  const leaving = useRef(false);
  const existingProductQuery = useQuery({
    queryKey: baseAuction
      ? producerProductKey(baseAuction.productId)
      : ['producer-product', 'none'],
    queryFn: () => fetchProducerProduct(baseAuction!.productId),
    enabled: Boolean(baseAuction),
    staleTime: 0,
  });
  const selectedProductId = baseAuction?.productId ?? chosenProductId;
  const selectedProduct = baseAuction
    ? existingProductQuery.data
    : productsQuery.data?.items.find((item) => item.id === selectedProductId);
  const beforeStart = useAuctionBeforeStart(baseAuction?.startsAt);
  const clearFieldError = (name: AuctionFieldName) => {
    setFieldErrors((current) =>
      current[name] ? { ...current, [name]: undefined } : current,
    );
  };
  const write = useMutation({
    mutationFn: async (input: CreateAuction | AuctionChanges) => {
      if (baseAuction)
        return authenticatedRequest<Auction>(
          `producer/auctions/${baseAuction.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ ...input, revision: baseAuction.revision }),
          },
        );
      return authenticatedRequest<Auction>('producer/auctions', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async (saved) => {
      client.setQueryData(auctionKey(saved.id), saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: auctionListKey }),
        client.invalidateQueries({ queryKey: producerProductListKey }),
        client.invalidateQueries({
          queryKey: producerProductKey(saved.productId),
        }),
      ]);
      leaving.current = true;
      await navigate({
        to: '/producer/auctions/$auctionId',
        params: { auctionId: saved.id },
      });
    },
  });

  const form = useForm({
    defaultValues: {
      productId: auction?.productId ?? '',
      quantity: String(auction?.quantity ?? 1),
      startingPrice: auction
        ? (auction.startingPriceCents / 100).toFixed(2)
        : '',
      increment: auction
        ? (auction.minimumIncrementCents / 100).toFixed(2)
        : '',
      startsAt: auction ? asLocalDateTime(auction.startsAt) : '',
      endsAt: auction ? asLocalDateTime(auction.endsAt) : '',
    },
    onSubmit: async ({ value }) => {
      const quantityText = value.quantity.trim();
      const quantity = /^\d+$/.test(quantityText)
        ? Number(quantityText)
        : Number.NaN;
      const startingPriceCents = toCents(value.startingPrice);
      const minimumIncrementCents = toCents(value.increment);
      const startsAt = localToIso(value.startsAt);
      const endsAt = localToIso(value.endsAt);
      const selected = selectedProduct;
      const maxQuantity = selected
        ? selected.availableStock + (baseAuction?.quantity ?? 0)
        : 0;
      const validation: Partial<Record<AuctionFieldName, string>> = {};
      if (!selected && !baseAuction)
        validation.productId = 'Choose one of your published products.';
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000)
        validation.quantity = 'Enter a whole lot quantity from 1 to 1,000,000.';
      else if (quantity > maxQuantity)
        validation.quantity = `Only ${maxQuantity} ${maxQuantity === 1 ? 'unit is' : 'units are'} currently available for this lot.`;
      if (
        !Number.isSafeInteger(startingPriceCents) ||
        startingPriceCents < 1 ||
        startingPriceCents > 100_000_000
      )
        validation.startingPrice =
          'Enter a starting price from €0.01 to €1,000,000.00, using up to two decimal places.';
      if (
        !Number.isSafeInteger(minimumIncrementCents) ||
        minimumIncrementCents < 1 ||
        minimumIncrementCents > 100_000_000
      )
        validation.increment =
          'Enter a minimum increment from €0.01 to €1,000,000.00.';
      const startDate = startsAt ? new Date(startsAt) : undefined;
      const endDate = endsAt ? new Date(endsAt) : undefined;
      if (!startDate || startDate <= new Date())
        validation.startsAt = 'Choose a future start time.';
      if (!endDate || !startDate || endDate <= startDate)
        validation.endsAt = 'Choose an end time after the start time.';

      setFieldErrors(validation);
      if (Object.keys(validation).length > 0) {
        if (validation.productId)
          document.getElementById('auction-product')?.focus();
        else if (validation.quantity)
          document.getElementById('auction-quantity')?.focus();
        else if (validation.startingPrice)
          document.getElementById('auction-starting-price')?.focus();
        else if (validation.increment)
          document.getElementById('auction-increment')?.focus();
        else if (validation.startsAt)
          document.getElementById('auction-starts-at')?.focus();
        else document.getElementById('auction-ends-at')?.focus();
        return;
      }
      setStockNote('');
      const payload = {
        quantity,
        startingPriceCents,
        minimumIncrementCents,
        startsAt,
        endsAt,
      };
      try {
        await write.mutateAsync(
          baseAuction ? payload : { ...payload, productId: value.productId },
        );
      } catch {
        // The error panel keeps entered values visible.
      }
    },
  });

  const unsaved = useStore(form.store, (state) => !state.isDefaultValue);
  const dirty = unsaved && !write.isSuccess;
  // Header links and the browser's back button.
  useBlocker({
    shouldBlockFn: () => {
      if (!dirty || leaving.current) return false;
      return !window.confirm(DISCARD_MESSAGE);
    },
    enableBeforeUnload: () => dirty && !leaving.current,
  });
  const requestLeave = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    leaving.current = true;
    void navigate({ to: '/producer/auctions' });
  };
  const reloadCurrent = async () => {
    if (!baseAuction) {
      setStockNote('');
      try {
        const fresh = await fetchProducerProducts();
        client.setQueryData(producerProductListKey, fresh);
        setStockNote(
          'Current available and reserved product stock has been reloaded. Review the lot quantity before saving again.',
        );
      } catch {
        setStockNote(
          'Could not reload current product stock. Your form values are still here.',
        );
      }
      return;
    }
    setStockNote('');
    try {
      const [fresh, product] = await Promise.all([
        fetchAuction(baseAuction.id),
        fetchProducerProduct(baseAuction.productId),
      ]);
      setBaseAuction(fresh);
      client.setQueryData(auctionKey(fresh.id), fresh);
      client.setQueryData(producerProductKey(product.id), product);
      form.setFieldValue('quantity', String(fresh.quantity));
      form.setFieldValue(
        'startingPrice',
        (fresh.startingPriceCents / 100).toFixed(2),
      );
      form.setFieldValue(
        'increment',
        (fresh.minimumIncrementCents / 100).toFixed(2),
      );
      form.setFieldValue('startsAt', asLocalDateTime(fresh.startsAt));
      form.setFieldValue('endsAt', asLocalDateTime(fresh.endsAt));
      write.reset();
      setFieldErrors({});
      setStockNote(
        'Current auction revision and product stock are loaded. Review the values before saving again.',
      );
    } catch {
      setStockNote(
        'Could not reload the current auction or product stock. Your form values are still here.',
      );
    }
  };

  if (!baseAuction && productsQuery.isPending)
    return (
      <>
        <BackToAuctions />
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading product stock…
        </Card>
      </>
    );
  if (!baseAuction && productsQuery.isError && !productsQuery.data)
    return (
      <>
        <BackToAuctions />
        <Card className="p-5" role="alert">
          <p className="text-sm text-destructive">
            Could not load your current product stock.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void productsQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      </>
    );
  if (
    baseAuction &&
    existingProductQuery.isPending &&
    !existingProductQuery.data
  )
    return (
      <>
        <BackToAuctions />
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading current product stock…
        </Card>
      </>
    );
  if (baseAuction && existingProductQuery.isError && !existingProductQuery.data)
    return (
      <>
        <BackToAuctions />
        <Card className="p-5" role="alert">
          <p className="text-sm text-destructive">
            Could not load the current product stock.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void existingProductQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      </>
    );

  const publishedProducts = (productsQuery.data?.items ?? []).filter(
    (item) => item.published && !item.archivedAt && !item.moderatedAt,
  );
  const noProducts = publishedProducts.length === 0 && !baseAuction;
  const title = baseAuction ? 'Edit scheduled auction' : 'New auction';
  const unit = selectedProduct ? formatUnit(selectedProduct.unit) : 'units';
  const photo = selectedProduct?.imageUrl ?? undefined;
  const maxLot = selectedProduct
    ? selectedProduct.availableStock + (baseAuction?.quantity ?? 0)
    : undefined;

  const stale = (
    <>
      {!writable && (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
        >
          Your current producer status could not be confirmed. Your entries are
          saved here, but you cannot submit until it refreshes.
        </p>
      )}
      {productsQuery.isError && productsQuery.data && !baseAuction && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
        >
          <p>
            Product stock could not be refreshed. The values shown may be out of
            date.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void productsQuery.refetch()}
          >
            Reload stock
          </Button>
        </div>
      )}
      {existingProductQuery.isError && existingProductQuery.data && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
        >
          <p>
            Product stock could not be refreshed. The values shown may be out of
            date.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void existingProductQuery.refetch()}
          >
            Reload stock
          </Button>
        </div>
      )}
    </>
  );

  if (noProducts)
    return (
      <div className="space-y-5">
        <BackToAuctions />
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {stale}
        <EmptyState
          icon={<PackagePlus />}
          title="Add a product first"
          description="You need a published product with available stock before you can schedule an auction."
          action={
            <Button asChild variant="outline">
              <Link to="/producer/products/new">Add a product</Link>
            </Button>
          }
        />
      </div>
    );

  return (
    <form
      noValidate
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="mb-5">
        <BackToAuctions onClick={requestLeave} />
        <h1 className="text-3xl md:text-4xl">{title}</h1>
      </div>
      <div className="mb-4 space-y-3 empty:hidden">{stale}</div>
      <fieldset
        disabled={write.isPending}
        className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5"
      >
        {/* The lot: product photo and stock, mirroring the auction page. */}
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70">
          <div className="aspect-[4/3] md:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[26rem]">
            {photo ? (
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-primary-foreground/30">
                <CalendarClock
                  aria-hidden="true"
                  className="size-16 stroke-[1.2]"
                />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          {!baseAuction && (
            <div className="absolute inset-x-0 top-0 p-3 md:p-4">
              <form.Field name="productId">
                {(field) => (
                  <span className="relative inline-flex max-w-full">
                    <select
                      id="auction-product"
                      name={field.name}
                      aria-label="Product"
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.productId)}
                      onChange={(event) => {
                        clearFieldError('productId');
                        field.handleChange(event.target.value);
                        setChosenProductId(event.target.value);
                      }}
                      className="h-9 max-w-full cursor-pointer appearance-none truncate rounded-full border-0 bg-white/90 pr-9 pl-4 text-sm font-medium text-foreground shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <option value="">Choose a product</option>
                      {publishedProducts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-foreground/60"
                    />
                  </span>
                )}
              </form.Field>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-6">
            {fieldErrors.productId && (
              <p
                id="auction-product-error"
                role="alert"
                className="mb-2 inline-block rounded-md bg-white/90 px-2 py-1 text-sm text-destructive"
              >
                {fieldErrors.productId}
              </p>
            )}
            <h2 className="text-3xl leading-tight break-words text-white md:text-5xl">
              {selectedProduct?.name ?? 'Choose a product'}
            </h2>
            {selectedProduct && (
              <p className="mt-2 text-sm text-white/85 tabular-nums">
                {selectedProduct.availableStock} {unit} available ·{' '}
                {selectedProduct.reservedStock} {unit} reserved in other
                auctions
                {baseAuction
                  ? ` · this lot holds ${baseAuction.quantity} ${unit}`
                  : ''}
              </p>
            )}
          </div>
        </section>

        {/* Terms: mirrors the bid panel. */}
        <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="border-b bg-secondary/40 p-5">
            <form.Field name="startingPrice">
              {(field) => (
                <FormField
                  id="auction-starting-price"
                  label="Starting price for the whole lot"
                  description="The opening bid for the entire quantity."
                  error={fieldErrors.startingPrice}
                >
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-2xl text-muted-foreground"
                    >
                      €
                    </span>
                    <Input
                      id="auction-starting-price"
                      name={field.name}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.startingPrice)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-starting-price',
                        Boolean(fieldErrors.startingPrice),
                      )}
                      onChange={(event) => {
                        clearFieldError('startingPrice');
                        field.handleChange(event.target.value);
                      }}
                      className="h-14 pl-8 text-3xl font-semibold tabular-nums"
                    />
                  </div>
                </FormField>
              )}
            </form.Field>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="increment">
                {(field) => (
                  <FormField
                    id="auction-increment"
                    label="Minimum increment (€)"
                    description="Least a bid must beat the current one by."
                    error={fieldErrors.increment}
                  >
                    <Input
                      id="auction-increment"
                      name={field.name}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.increment)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-increment',
                        Boolean(fieldErrors.increment),
                      )}
                      onChange={(event) => {
                        clearFieldError('increment');
                        field.handleChange(event.target.value);
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="quantity">
                {(field) => (
                  <FormField
                    id="auction-quantity"
                    label={`Lot quantity (${unit})`}
                    description={
                      maxLot === undefined
                        ? 'A whole number.'
                        : `Up to ${maxLot} available.`
                    }
                    error={fieldErrors.quantity}
                  >
                    <Input
                      id="auction-quantity"
                      name={field.name}
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      inputMode="numeric"
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.quantity)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-quantity',
                        Boolean(fieldErrors.quantity),
                      )}
                      onChange={(event) => {
                        clearFieldError('quantity');
                        field.handleChange(event.target.value);
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="startsAt">
              {(field) => (
                <FormField
                  id="auction-starts-at"
                  label="Starts"
                  description="Your local time."
                  error={fieldErrors.startsAt}
                >
                  <DateTimePicker
                    id="auction-starts-at"
                    value={field.state.value}
                    invalid={Boolean(fieldErrors.startsAt)}
                    describedBy={fieldDescriptionIds(
                      'auction-starts-at',
                      Boolean(fieldErrors.startsAt),
                    )}
                    onChange={(next) => {
                      clearFieldError('startsAt');
                      field.handleChange(next);
                    }}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="endsAt">
              {(field) => (
                <FormField
                  id="auction-ends-at"
                  label="Ends"
                  description="Must be after the start."
                  error={fieldErrors.endsAt}
                >
                  <DateTimePicker
                    id="auction-ends-at"
                    value={field.state.value}
                    invalid={Boolean(fieldErrors.endsAt)}
                    describedBy={fieldDescriptionIds(
                      'auction-ends-at',
                      Boolean(fieldErrors.endsAt),
                    )}
                    onChange={(next) => {
                      clearFieldError('endsAt');
                      field.handleChange(next);
                    }}
                  />
                </FormField>
              )}
            </form.Field>
          </div>
          <div className="mt-auto space-y-3 p-5 pt-0">
            {write.isError &&
              write.error instanceof ApiError &&
              write.error.status !== 409 && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(
                    write.error,
                    baseAuction ? 'save the auction' : 'create the auction',
                  )}
                </p>
              )}
            {write.isError &&
              write.error instanceof ApiError &&
              write.error.status === 409 && (
                <div
                  role="alert"
                  className="space-y-3 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
                >
                  <p>
                    {errorMessage(
                      write.error,
                      baseAuction ? 'save the auction' : 'create the auction',
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void reloadCurrent()}
                  >
                    {baseAuction
                      ? 'Reload current auction and stock'
                      : 'Reload current product stock'}
                  </Button>
                </div>
              )}
            {stockNote && (
              <p role="status" className="text-sm text-muted-foreground">
                {stockNote}
              </p>
            )}
            {write.isPending && (
              <p className="text-sm text-muted-foreground" role="status">
                {write.isPaused
                  ? 'Waiting for a connection. Your auction will save automatically when you’re back online.'
                  : 'Saving auction…'}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Bids are for the whole lot. Its quantity is reserved from normal
              product stock until the auction is cancelled or settled.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-12 flex-1 text-base"
                disabled={
                  !writable ||
                  write.isPending ||
                  (baseAuction !== undefined &&
                    (baseAuction.status !== 'scheduled' ||
                      beforeStart !== true))
                }
              >
                {write.isPaused
                  ? 'Waiting for connection…'
                  : write.isPending
                    ? 'Saving…'
                    : baseAuction
                      ? 'Save changes'
                      : 'Schedule auction'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={requestLeave}
              >
                Cancel
              </Button>
            </div>
          </div>
        </aside>
      </fieldset>
    </form>
  );
}
