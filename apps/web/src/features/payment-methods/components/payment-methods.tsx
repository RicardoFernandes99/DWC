import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { ApiError, authenticatedRequest } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { EmptyState } from '@/components/shared/empty-state';
import { CreditCard, Plus } from 'lucide-react';

type PaymentMethod = components['schemas']['PaymentMethodResponseDto'];
type CreatePaymentMethod = components['schemas']['CreatePaymentMethodDto'];
const paymentMethodsKey = (buyerId: string) =>
  ['payment-methods', buyerId] as const;

function listMethods(): Promise<PaymentMethod[]> {
  return authenticatedRequest<PaymentMethod[]>('payment-methods');
}

function saveMethod(input: CreatePaymentMethod): Promise<PaymentMethod> {
  return authenticatedRequest<PaymentMethod>('payment-methods', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

function currentUtcMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function PaymentMethods({ buyerId }: { buyerId: string }) {
  const queryClient = useQueryClient();
  const key = paymentMethodsKey(buyerId);
  const [cardError, setCardError] = useState('');
  const [expiryError, setExpiryError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const methods = useQuery({
    queryKey: key,
    queryFn: listMethods,
    retry: false,
  });
  // The form is always open while there are no cards to show.
  const showForm = formOpen || (methods.isSuccess && methods.data.length === 0);
  const mutation = useMutation({
    mutationFn: saveMethod,
    onSuccess: async (created) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<PaymentMethod[]>(key, (existing) => [
        created,
        ...(existing ?? []),
      ]);
      void queryClient.invalidateQueries({ queryKey: key });
      form.reset();
      setCardError('');
      setExpiryError('');
      setFormOpen(false);
    },
  });
  const form = useForm({
    defaultValues: { number: '', month: '', year: '' },
    onSubmit: async ({ value }) => {
      setCardError('');
      setExpiryError('');
      const digits = value.number.replaceAll(' ', '');
      if (!/^\d{4,19}$/.test(digits)) {
        setCardError('Enter at least four digits.');
        document.getElementById('card-number')?.focus();
        return;
      }
      const month = Number(value.month);
      const year = Number(value.year);
      const now = currentUtcMonth();
      if (
        !/^\d{1,2}$/.test(value.month) ||
        month < 1 ||
        month > 12 ||
        !/^\d{4}$/.test(value.year) ||
        year < 1000 ||
        year > 9999 ||
        year < now.year ||
        (year === now.year && month < now.month)
      ) {
        setExpiryError(
          'Enter a valid expiry month and year that has not passed.',
        );
        document.getElementById('expiry-month')?.focus();
        return;
      }
      try {
        await mutation.mutateAsync({
          last4: digits.slice(-4),
          expiryMonth: month,
          expiryYear: year,
        });
      } catch {
        // Mutation state renders the retryable error; form state retains the input.
      }
    },
  });

  return (
    <section className="mt-8" aria-labelledby="payment-methods-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="payment-methods-title"
            className="font-sans text-lg font-semibold"
          >
            Payment methods
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save card details for future checkout and bidding.
          </p>
        </div>
        {!showForm && (
          <Button variant="ghost" size="sm" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden="true" /> Add card
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {showForm && (
          <div className="rounded-lg border p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Add a card</h3>
              {Boolean(methods.data?.length) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <form.Field name="number">
                {(field) => (
                  <FormField
                    id="card-number"
                    label="Card number"
                    description="Enter the digits shown on your card. No security code is needed."
                    error={cardError}
                  >
                    <Input
                      id="card-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={23}
                      placeholder="1234 5678 9012 3456"
                      value={field.state.value}
                      aria-invalid={!!cardError}
                      aria-describedby={
                        cardError
                          ? 'card-number-error'
                          : 'card-number-description'
                      }
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        mutation.reset();
                        setCardError('');
                        field.handleChange(
                          event.target.value
                            .replace(/[^\d ]/g, '')
                            .slice(0, 23),
                        );
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
              <div className="grid grid-cols-2 gap-4">
                <form.Field name="month">
                  {(field) => (
                    <FormField id="expiry-month" label="Expiry month">
                      <Input
                        id="expiry-month"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp-month"
                        placeholder="MM"
                        maxLength={2}
                        value={field.state.value}
                        aria-invalid={!!expiryError}
                        aria-describedby={
                          expiryError ? 'expiry-error' : undefined
                        }
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          mutation.reset();
                          setExpiryError('');
                          field.handleChange(
                            event.target.value.replace(/\D/g, '').slice(0, 2),
                          );
                        }}
                      />
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="year">
                  {(field) => (
                    <FormField id="expiry-year" label="Expiry year">
                      <Input
                        id="expiry-year"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp-year"
                        placeholder="YYYY"
                        maxLength={4}
                        value={field.state.value}
                        aria-invalid={!!expiryError}
                        aria-describedby={
                          expiryError ? 'expiry-error' : undefined
                        }
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          mutation.reset();
                          setExpiryError('');
                          field.handleChange(
                            event.target.value.replace(/\D/g, '').slice(0, 4),
                          );
                        }}
                      />
                    </FormField>
                  )}
                </form.Field>
              </div>
              {expiryError && (
                <p
                  id="expiry-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {expiryError}
                </p>
              )}
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {mutation.error instanceof ApiError &&
                  mutation.error.status === 400
                    ? 'The expiry date was rejected. Check the month and year and try again.'
                    : mutation.error instanceof Error
                      ? mutation.error.message
                      : 'Could not save this card. Please try again.'}
                </p>
              )}
              {mutation.isSuccess && (
                <p role="status" className="text-sm text-primary">
                  Card saved.
                </p>
              )}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <Button
                    type="submit"
                    disabled={submitting || mutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {submitting || mutation.isPending ? 'Saving…' : 'Save card'}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </div>
        )}
        <div aria-live="polite" aria-busy={methods.isPending}>
          {methods.isError && methods.data && (
            <div
              className="mb-3 rounded-lg border border-destructive/30 bg-card p-4 text-sm"
              role="alert"
            >
              <p className="text-destructive">
                Could not refresh your saved cards. The information shown may be
                out of date.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={methods.isFetching}
                onClick={() => void methods.refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {methods.isPending ? (
            <Card className="p-6 text-sm text-muted-foreground" role="status">
              Loading payment methods…
            </Card>
          ) : methods.isError && !methods.data ? (
            <Card className="p-6" role="alert">
              <p className="text-sm text-destructive">
                {methods.error instanceof Error
                  ? methods.error.message
                  : 'Could not load payment methods.'}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void methods.refetch()}
              >
                Try again
              </Button>
            </Card>
          ) : methods.data.length === 0 ? (
            <EmptyState
              headingLevel="h3"
              icon={<CreditCard />}
              title="No saved cards yet"
              description="Add a card to check out faster and to bid in auctions."
            />
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Saved cards">
              {methods.data.map((method) => (
                <li
                  key={method.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <CreditCard
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                  <p className="min-w-0 flex-1 font-medium">
                    <span className="sr-only">Card ending in </span>
                    <span aria-hidden="true">•••• </span>
                    <span className="tabular-nums">{method.last4}</span>
                  </p>
                  {method.expired ? (
                    <span className="text-sm font-medium text-destructive">
                      Expired
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Expires {String(method.expiryMonth).padStart(2, '0')}/
                      {String(method.expiryYear).slice(-2)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
