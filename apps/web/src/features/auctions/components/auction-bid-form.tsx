import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AuctionBidAcknowledgement,
  AuctionLiveStatePayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@dwc/realtime-contracts';
import { Link } from '@tanstack/react-router';
import type { Socket } from 'socket.io-client';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { formatMoney } from '@/lib/format';
import { getAccessToken, refresh, type User } from '@/lib/session';
import {
  fetchAuctionPaymentMethods,
  type AuctionLiveState,
  type PaymentMethod,
} from '../auction-data';
import { minimumBid } from './auction-room-utils';

type PendingBid = {
  requestId: string;
  amountCents: number;
  paymentMethodId: string;
};
type AuctionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function retryStorageKey(buyerId: string, auctionId: string) {
  return `dwc-auction-bid-retry:${buyerId}:${auctionId}`;
}

function readPendingBid(
  buyerId: string | undefined,
  auctionId: string,
): PendingBid | null {
  if (!buyerId || typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(retryStorageKey(buyerId, auctionId)) ??
        'null',
    );
    if (
      typeof value === 'object' &&
      value !== null &&
      'requestId' in value &&
      typeof value.requestId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.requestId,
      ) &&
      'amountCents' in value &&
      typeof value.amountCents === 'number' &&
      Number.isSafeInteger(value.amountCents) &&
      value.amountCents > 0 &&
      'paymentMethodId' in value &&
      typeof value.paymentMethodId === 'string' &&
      /^[a-f\d]{24}$/i.test(value.paymentMethodId)
    )
      return {
        requestId: value.requestId,
        amountCents: value.amountCents,
        paymentMethodId: value.paymentMethodId,
      };
  } catch {
    return null;
  }
  return null;
}

function storePendingBid(
  buyerId: string,
  auctionId: string,
  value: PendingBid | null,
) {
  try {
    const key = retryStorageKey(buyerId, auctionId);
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    // The in-memory retry remains available if browser storage is blocked.
  }
}

export function AuctionBidForm({
  auctionId,
  user,
  live,
  socket,
  onAcknowledged,
}: {
  auctionId: string;
  user: User | null | undefined;
  live: AuctionLiveState | undefined;
  socket: AuctionSocket | null;
  onAcknowledged: (state?: AuctionLiveStatePayload) => void;
}) {
  const methods = useQuery({
    queryKey: ['payment-methods', user?.id],
    queryFn: fetchAuctionPaymentMethods,
    enabled: user?.role === 'buyer',
    retry: false,
  });
  const eligibleMethods = (methods.data ?? []).filter(
    (method) => !method.expired,
  );
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingBid | null>(() =>
    readPendingBid(user?.id, auctionId),
  );
  const [submitting, setSubmitting] = useState(false);
  const currentMinimum = minimumBid(live);
  const selectedMethod = eligibleMethods.find(
    (method) => method.id === (selectedMethodId || eligibleMethods[0]?.id),
  );
  const canBid =
    live?.state === 'active' &&
    Boolean(selectedMethod) &&
    user?.buyerStatus !== 'suspended';

  useEffect(() => {
    if (pending && user?.id) storePendingBid(user.id, auctionId, pending);
  }, [auctionId, pending, user?.id]);

  if (!user)
    return (
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">Sign in to bid</h2>
        <p className="text-sm text-muted-foreground">
          Anyone can watch. Bidding requires a buyer account and an eligible
          saved card.
        </p>
        <Link
          to="/login"
          search={{
            returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          }}
          className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
        >
          Sign in to continue
        </Link>
      </Card>
    );
  if (user.role === 'producer')
    return (
      <Card className="p-4" role="status">
        <h2 className="font-semibold">Producer viewing mode</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Producers can watch this auction but cannot place bids.
        </p>
      </Card>
    );
  if (user.role !== 'buyer') return null;
  if (methods.isPending && !pending)
    return (
      <Card className="p-4 text-sm text-muted-foreground" role="status">
        Checking saved payment methods…
      </Card>
    );
  if (methods.isError && !pending)
    return (
      <Card className="p-4" role="alert">
        <p className="text-sm text-destructive">
          Saved payment methods could not load, so bidding is unavailable.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void methods.refetch()}
        >
          Try again
        </Button>
      </Card>
    );
  if (eligibleMethods.length === 0 && !pending)
    return (
      <Card className="p-4">
        <h2 className="font-semibold">Add an eligible payment card</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An unexpired saved card is required before bidding.
        </p>
        <Link
          to="/account"
          className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4"
        >
          <CreditCard aria-hidden="true" className="size-4" /> Manage payment
          methods
        </Link>
      </Card>
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if ((!live && !pending) || (!selectedMethod && !pending)) {
      setError('A current buyer session and eligible saved card are required.');
      return;
    }
    const amountCents =
      pending?.amountCents ?? Math.round(Number(amount) * 100);
    if (
      !Number.isSafeInteger(amountCents) ||
      (!pending && amountCents < currentMinimum)
    ) {
      setError(
        `Enter at least ${formatMoney(currentMinimum)} for the whole lot.`,
      );
      return;
    }
    let request = pending;
    if (!request) {
      if (!selectedMethod) {
        setError('Choose an eligible saved payment method.');
        return;
      }
      request = {
        requestId: crypto.randomUUID(),
        amountCents,
        paymentMethodId: selectedMethod.id,
      };
    }
    if (!pending) {
      setPending(request);
      storePendingBid(user.id, auctionId, request);
    }
    const accessToken = getAccessToken();
    if (!accessToken || !socket?.connected) {
      setError(
        'The live connection is unavailable. Retry this same bid when it reconnects.',
      );
      return;
    }
    setSubmitting(true);
    const response = new Promise<AuctionBidAcknowledgement>(
      (resolve, reject) => {
        socket
          .timeout(10_000)
          .emit(
            'auction.bid',
            { ...request, auctionId, accessToken },
            (timeoutError, acknowledgement) => {
              if (timeoutError || !acknowledgement)
                reject(new Error('No bid response was received.'));
              else resolve(acknowledgement);
            },
          );
      },
    );
    void response
      .then((acknowledgement) => {
        if (acknowledgement.ok) {
          setPending(null);
          storePendingBid(user.id, auctionId, null);
          setAmount('');
          setError('Bid accepted. The server confirmed your bid.');
          onAcknowledged(acknowledgement.state);
          return;
        }
        if (acknowledgement.code === 'unauthorized') {
          void refresh()
            .then(() => {
              setError(
                'Your buyer session was refreshed. Retry the same bid to send the saved request safely.',
              );
            })
            .catch(() => {
              setError(
                'Your buyer session expired. Sign in again, then retry the same bid.',
              );
            });
          return;
        }
        setPending(null);
        storePendingBid(user.id, auctionId, null);
        setError(acknowledgement.message);
        onAcknowledged();
      })
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error
            ? `${failure.message} Retry uses the same request ID, so it cannot place this bid twice.`
            : 'No bid response was received. Retry the same bid safely.',
        );
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-lg font-semibold">Place a bid</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Minimum bid for the whole lot:{' '}
        <strong className="text-foreground tabular-nums">
          {formatMoney(currentMinimum)}
        </strong>
      </p>
      {user?.buyerStatus === 'suspended' && !pending && (
        <p
          role="status"
          className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
        >
          New bids are paused for this account.{' '}
          {user.buyerSuspensionReason
            ? `Reason: ${user.buyerSuspensionReason}`
            : 'Your account can still watch the auction.'}
        </p>
      )}
      {live?.state === 'finished' && !pending ? (
        <p className="mt-4 text-sm text-muted-foreground">Bidding has ended.</p>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={submit}
          data-auction-bid-form
        >
          <FormField id="auction-bid-amount" label="Your bid for the whole lot">
            <Input
              id="auction-bid-amount"
              type="number"
              inputMode="decimal"
              min={currentMinimum / 100}
              step="0.01"
              required
              value={pending ? (pending.amountCents / 100).toFixed(2) : amount}
              disabled={Boolean(pending) || submitting || !canBid}
              onChange={(event) => setAmount(event.target.value)}
              aria-describedby="auction-bid-help"
            />
          </FormField>
          <p id="auction-bid-help" className="text-xs text-muted-foreground">
            The first bid may match the starting price. Later bids must meet the
            displayed increment.
          </p>
          <div>
            <label
              htmlFor="auction-payment-method"
              className="text-sm font-medium"
            >
              Saved payment method
            </label>
            <select
              id="auction-payment-method"
              value={pending?.paymentMethodId ?? selectedMethod?.id ?? ''}
              disabled={Boolean(pending) || submitting}
              onChange={(event) => setSelectedMethodId(event.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pending &&
                !eligibleMethods.some(
                  (method) => method.id === pending.paymentMethodId,
                ) && (
                  <option value={pending.paymentMethodId}>
                    Original card unavailable · retry the same request
                  </option>
                )}
              {eligibleMethods.map((method: PaymentMethod) => (
                <option key={method.id} value={method.id}>
                  Card ending {method.last4} · expires{' '}
                  {String(method.expiryMonth).padStart(2, '0')}/
                  {method.expiryYear}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            disabled={submitting || (!canBid && !pending)}
            className="w-full sm:w-auto"
          >
            {submitting
              ? 'Waiting for server…'
              : pending
                ? 'Retry same bid'
                : 'Submit bid'}
          </Button>
          {pending && !submitting && (
            <p className="text-sm text-muted-foreground" role="status">
              The previous response was not received. Retrying uses the same
              request ID and amount.
            </p>
          )}
          {error && (
            <p
              role={error.startsWith('Bid accepted') ? 'status' : 'alert'}
              className={`text-sm ${error.startsWith('Bid accepted') ? 'text-primary' : 'text-destructive'}`}
            >
              {error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
