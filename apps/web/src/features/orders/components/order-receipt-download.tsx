import { useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, authenticatedDownload } from '@/lib/session';

export function OrderReceiptDownload({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const blob = await authenticatedDownload(
        `orders/${encodeURIComponent(orderId)}/receipt.pdf`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `purchase-receipt-${orderId}.pdf`;
      link.style.display = 'none';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'The receipt could not be downloaded. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="order-receipt-download">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        aria-describedby={error ? 'order-receipt-error' : undefined}
        onClick={() => void download()}
      >
        <Download aria-hidden="true" />
        {pending ? 'Preparing PDF…' : 'Download purchase receipt'}
      </Button>
      {pending && (
        <p role="status" className="order-receipt-download-status">
          Preparing your purchase receipt.
        </p>
      )}
      {error && (
        <p
          id="order-receipt-error"
          role="alert"
          className="order-receipt-download-error"
        >
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
