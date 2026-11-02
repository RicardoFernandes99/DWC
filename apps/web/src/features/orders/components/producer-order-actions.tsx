import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { orderStatusText } from './order-format';

type Order = components['schemas']['OrderResponseDto'];
type OrderStatus = Order['status'];

export function ProducerOrderActions({
  order,
  next,
  pending,
  reason,
  setReason,
  act,
}: {
  order: Order;
  next: OrderStatus | undefined;
  pending: boolean;
  reason: string;
  setReason: (value: string) => void;
  act: (
    endpoint: string,
    method: 'PATCH' | 'POST',
    body?: Record<string, unknown>,
  ) => void;
}) {
  const [confirm, setConfirm] = useState<'accept' | 'cancel' | null>(null);
  const openRequest = order.refundRequest?.status === 'open';
  const canProgress =
    Boolean(next) && !(order.status === 'pending' && openRequest);
  return (
    <Card className="p-5 md:p-7">
      <h2 className="text-lg font-semibold">Order actions</h2>
      {openRequest && (
        <div className="mt-4 rounded-md border border-highlight bg-highlight/35 p-4 text-sm">
          <p className="font-medium">Refund request needs a decision</p>
          <p className="mt-1">
            Confirmation is blocked while this request is open.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={pending}
              onClick={() => setConfirm(confirm === 'accept' ? null : 'accept')}
            >
              Accept and refund {formatMoney(order.totalCents)}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setConfirm(null)}
            >
              Keep pending
            </Button>
          </div>
          {confirm === 'accept' && (
            <div className="mt-4 rounded-md border bg-card p-4">
              <p className="text-sm">
                Accept this request and refund {formatMoney(order.totalCents)}{' '}
                for this order, including its delivery fee?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() =>
                    act(`orders/${order.id}/refund-requests/accept`, 'POST')
                  }
                >
                  {pending ? 'Processing…' : 'Confirm refund'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Go back
                </Button>
              </div>
            </div>
          )}
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim())
                act(`orders/${order.id}/refund-requests/decline`, 'POST', {
                  reason: reason.trim(),
                });
            }}
          >
            <label
              className="block text-sm font-medium"
              htmlFor="decline-reason"
            >
              Decline reason
            </label>
            <Textarea
              id="decline-reason"
              maxLength={500}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="decline-reason-help"
            />
            <p
              id="decline-reason-help"
              className="text-xs text-muted-foreground"
            >
              This reason is shared with the buyer.
            </p>
            <Button
              type="submit"
              variant="outline"
              className="min-h-11"
              disabled={!reason.trim() || pending}
            >
              {pending ? 'Sending…' : 'Decline request'}
            </Button>
          </form>
        </div>
      )}
      {canProgress && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            Advance this {order.fulfilmentMethod} order by one step.
          </p>
          <Button
            type="button"
            className="mt-3 min-h-11"
            disabled={pending}
            onClick={() =>
              act(`orders/${order.id}/status`, 'PATCH', {
                status: next,
                expectedRevision: order.revision,
              })
            }
          >
            {pending ? 'Updating…' : `Mark ${orderStatusText(next!)}`}
          </Button>
        </div>
      )}
      {order.status === 'pending' && order.origin === 'catalogue' && (
        <div className="mt-5 border-t pt-5">
          <p className="text-sm text-muted-foreground">
            Cancel this order and refund its full order total of{' '}
            {formatMoney(order.totalCents)}, including the delivery fee.
          </p>
          {confirm === 'cancel' ? (
            <div className="mt-3 rounded-md border p-4">
              <p className="text-sm">
                The buyer will be refunded {formatMoney(order.totalCents)}. This
                action cannot be undone.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() =>
                    act(`orders/${order.id}/cancel-refund`, 'POST')
                  }
                >
                  {pending ? 'Processing…' : 'Confirm cancellation and refund'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                >
                  Go back
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              disabled={pending}
              onClick={() => setConfirm('cancel')}
            >
              Cancel and refund…
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
