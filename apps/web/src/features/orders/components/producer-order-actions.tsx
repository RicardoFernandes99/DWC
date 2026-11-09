import { useRef, useState } from 'react';
import { ArrowRight, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { orderStatusText } from './order-format';

type Order = components['schemas']['OrderResponseDto'];
export type OrderAction = (
  endpoint: string,
  method: 'PATCH' | 'POST',
  body?: Record<string, unknown>,
) => void;
export function ProducerOrderActions({
  order,
  next,
  pending,
  reason,
  setReason,
  act,
}: {
  order: Order;
  next: Order['status'] | undefined;
  pending: boolean;
  reason: string;
  setReason: (value: string) => void;
  act: OrderAction;
}) {
  const [decision, setDecision] = useState<
    'accept' | 'decline' | 'cancel' | null
  >(null);
  const decisionTrigger = useRef<HTMLButtonElement | null>(null);
  function toggleDecision(
    value: NonNullable<typeof decision>,
    trigger: HTMLButtonElement,
  ) {
    decisionTrigger.current = trigger;
    setDecision(decision === value ? null : value);
  }
  function closeDecision() {
    setDecision(null);
    decisionTrigger.current?.focus();
  }
  const openRequest = order.refundRequest?.status === 'open';
  const canProgress = next && !(order.status === 'pending' && openRequest);
  // With an open refund request, Accept already does this; don't offer it twice.
  const canCancel =
    order.status === 'pending' && order.origin === 'catalogue' && !openRequest;
  if (!openRequest && !canProgress && !canCancel) return null;
  return (
    <section className="order-actions" aria-label="Order actions">
      {openRequest ? (
        <>
          <div className="order-action-title">
            <Undo2 size={17} aria-hidden="true" />
            <h2>A refund needs your decision</h2>
          </div>
          <p className="order-action-copy">
            Confirmation is paused while this request is open.
          </p>
          <div className="order-button-row">
            <Button
              disabled={pending}
              onClick={(event) => toggleDecision('accept', event.currentTarget)}
              aria-expanded={decision === 'accept'}
            >
              Accept and refund {formatMoney(order.totalCents)}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={(event) =>
                toggleDecision('decline', event.currentTarget)
              }
              aria-expanded={decision === 'decline'}
            >
              Decline request
            </Button>
          </div>
        </>
      ) : canProgress ? (
        <div className="order-next-action">
          <div>
            <h2>Ready for the next step?</h2>
            <p className="order-action-copy">
              {next === 'confirmed'
                ? 'Confirm that you can fulfil this order.'
                : next === 'shipped'
                  ? 'Let the buyer know their order is on its way.'
                  : next === 'ready_for_collection'
                    ? 'Let the buyer know their order is ready.'
                    : 'Record the completed handover.'}
            </p>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              act(`orders/${order.id}/status`, 'PATCH', {
                status: next,
                expectedRevision: order.revision,
              })
            }
          >
            {pending ? 'Updating…' : `Mark ${orderStatusText(next)}`}
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {decision === 'decline' && openRequest && (
        <form
          className="order-decision"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim())
              act(`orders/${order.id}/refund-requests/decline`, 'POST', {
                reason: reason.trim(),
              });
          }}
        >
          <label htmlFor="decline-reason">Decline reason</label>
          <Textarea
            id="decline-reason"
            maxLength={500}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby="decline-reason-help"
          />
          <p id="decline-reason-help" className="order-meta">
            This reason is shared with the buyer.
          </p>
          <div className="order-button-row">
            <Button
              type="submit"
              variant="outline"
              disabled={!reason.trim() || pending}
            >
              {pending ? 'Sending…' : 'Confirm decline'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={closeDecision}
            >
              Go back
            </Button>
          </div>
        </form>
      )}
      {((decision === 'accept' && openRequest) ||
        (decision === 'cancel' && canCancel)) && (
        <div
          className="order-decision"
          role="group"
          aria-label="Confirm refund"
        >
          <p className="order-confirm-amount">
            {formatMoney(order.totalCents)} <span>will be refunded</span>
          </p>
          <p className="order-action-copy">
            {decision === 'accept'
              ? 'Accept this request and cancel this order, including its delivery fee?'
              : 'Cancel this order, including its delivery fee?'}{' '}
            The refund cannot be undone.
          </p>
          <div className="order-button-row">
            <Button
              variant={decision === 'cancel' ? 'destructive' : 'default'}
              disabled={pending}
              onClick={() =>
                act(
                  `orders/${order.id}/${decision === 'accept' ? 'refund-requests/accept' : 'cancel-refund'}`,
                  'POST',
                )
              }
            >
              {pending
                ? 'Processing…'
                : decision === 'accept'
                  ? 'Confirm refund'
                  : 'Confirm cancellation and refund'}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={closeDecision}>
              Go back
            </Button>
          </div>
        </div>
      )}
      {canCancel && (
        <div className="order-cancel-action">
          <Button
            variant="link"
            disabled={pending}
            onClick={(event) => toggleDecision('cancel', event.currentTarget)}
            aria-expanded={decision === 'cancel'}
          >
            Cancel and refund…
          </Button>
          <span>Refund this order's full {formatMoney(order.totalCents)}.</span>
        </div>
      )}
    </section>
  );
}
