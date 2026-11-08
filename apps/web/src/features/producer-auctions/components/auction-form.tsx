import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
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
import { PackagePlus } from 'lucide-react';

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
      <Card className="p-5 text-sm text-muted-foreground" role="status">
        Loading product stock…
      </Card>
    );
  if (!baseAuction && productsQuery.isError && !productsQuery.data)
    return (
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
    );
  if (
    baseAuction &&
    existingProductQuery.isPending &&
    !existingProductQuery.data
  )
    return (
      <Card className="p-5 text-sm text-muted-foreground" role="status">
        Loading current product stock…
      </Card>
    );
  if (baseAuction && existingProductQuery.isError && !existingProductQuery.data)
    return (
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
    );

  return (
    <Card className="min-w-0 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {baseAuction ? 'Edit scheduled auction' : 'Create an auction lot'}
          </h1>
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Bids are for the whole lot. Its quantity is reserved from normal
            product stock until the auction is cancelled or settled.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/producer/auctions">Back to auctions</Link>
        </Button>
      </div>
      {!writable && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
        >
          Your current producer status could not be confirmed. Your entries are
          saved here, but you cannot submit until it refreshes.
        </p>
      )}
      {productsQuery.isError && productsQuery.data && !baseAuction && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
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
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
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
      {(productsQuery.data?.items ?? []).filter(
        (item) => item.published && !item.archivedAt && !item.moderatedAt,
      ).length === 0 && !baseAuction ? (
        <EmptyState
          className="mt-6"
          icon={<PackagePlus />}
          title="Add a product first"
          description="You need a published product with available stock before you can schedule an auction."
          action={
            <Button asChild variant="outline">
              <Link to="/producer/products/new">Add a product</Link>
            </Button>
          }
        />
      ) : (
        <form
          className="mt-6 space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <fieldset disabled={write.isPending} className="min-w-0 space-y-5">
            {!baseAuction && (
              <form.Field name="productId">
                {(field) => (
                  <FormField
                    id="auction-product"
                    label="Product"
                    description="Only published products are available. Stock shown here is the server’s current available amount."
                    error={fieldErrors.productId}
                  >
                    <select
                      id="auction-product"
                      name={field.name}
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.productId)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-product',
                        Boolean(fieldErrors.productId),
                      )}
                      onChange={(event) => {
                        clearFieldError('productId');
                        field.handleChange(event.target.value);
                        setChosenProductId(event.target.value);
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="">Choose a product</option>
                      {(productsQuery.data?.items ?? [])
                        .filter(
                          (item) =>
                            item.published &&
                            !item.archivedAt &&
                            !item.moderatedAt,
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} — {item.availableStock} available ·{' '}
                            {item.reservedStock} reserved
                          </option>
                        ))}
                    </select>
                  </FormField>
                )}
              </form.Field>
            )}
            {selectedProduct && (
              <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
                <h3 className="font-medium">{selectedProduct.name}</h3>
                <p className="mt-1 text-muted-foreground">
                  {selectedProduct.availableStock}{' '}
                  {formatUnit(selectedProduct.unit)} available ·{' '}
                  {selectedProduct.reservedStock}{' '}
                  {formatUnit(selectedProduct.unit)} reserved
                </p>
                {baseAuction && (
                  <p className="mt-1 text-muted-foreground">
                    This auction already reserves {baseAuction.quantity}{' '}
                    {formatUnit(selectedProduct.unit)}. You may use the current
                    available stock plus this lot when changing its quantity.
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <form.Field name="quantity">
                {(field) => (
                  <FormField
                    id="auction-quantity"
                    label={`Lot quantity${selectedProduct ? ` (${formatUnit(selectedProduct.unit)})` : ''}`}
                    description="Use a whole number of product units."
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
              <form.Field name="startingPrice">
                {(field) => (
                  <FormField
                    id="auction-starting-price"
                    label="Starting price for the whole lot (€)"
                    description="Enter euros and cents. This is the opening bid for the entire quantity."
                    error={fieldErrors.startingPrice}
                  >
                    <Input
                      id="auction-starting-price"
                      name={field.name}
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      required
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
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="increment">
                {(field) => (
                  <FormField
                    id="auction-increment"
                    label="Minimum bid increment (€)"
                    description="The next bid must be at least this much above the current high bid."
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
              <form.Field name="startsAt">
                {(field) => (
                  <FormField
                    id="auction-starts-at"
                    label="Auction starts"
                    description="Displayed in your local time; sent to the server as an exact timestamp."
                    error={fieldErrors.startsAt}
                  >
                    <Input
                      id="auction-starts-at"
                      name={field.name}
                      type="datetime-local"
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.startsAt)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-starts-at',
                        Boolean(fieldErrors.startsAt),
                      )}
                      onChange={(event) => {
                        clearFieldError('startsAt');
                        field.handleChange(event.target.value);
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="endsAt">
                {(field) => (
                  <FormField
                    id="auction-ends-at"
                    label="Auction ends"
                    description="The end must be after the start."
                    error={fieldErrors.endsAt}
                  >
                    <Input
                      id="auction-ends-at"
                      name={field.name}
                      type="datetime-local"
                      required
                      value={field.state.value}
                      aria-invalid={Boolean(fieldErrors.endsAt)}
                      aria-describedby={fieldDescriptionIds(
                        'auction-ends-at',
                        Boolean(fieldErrors.endsAt),
                      )}
                      onChange={(event) => {
                        clearFieldError('endsAt');
                        field.handleChange(event.target.value);
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
          </fieldset>
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
                className="space-y-3 rounded-lg border border-warning/40 bg-warning/20 p-4 text-sm"
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
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="submit"
              disabled={
                !writable ||
                write.isPending ||
                (baseAuction !== undefined &&
                  (baseAuction.status !== 'scheduled' || beforeStart !== true))
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
            <Button asChild type="button" variant="outline">
              <Link to="/producer/auctions">Cancel</Link>
            </Button>
          </div>
          {write.isPending && (
            <p className="text-sm text-muted-foreground" role="status">
              {write.isPaused
                ? 'Waiting for a connection. Your auction will save automatically when you’re back online.'
                : 'Saving auction…'}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
