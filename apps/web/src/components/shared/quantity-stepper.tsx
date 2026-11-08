import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Quantity control: − / + buttons around a number that can also be typed.
 * A typed value commits on Enter or blur and is clamped to [1, max].
 *
 * - `grouped`: one bordered box with plain buttons (product page).
 * - `outline`: separate outline buttons with the number between (cart).
 */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled = false,
  label = 'Quantity',
  variant = 'grouped',
  className,
}: {
  value: number;
  /** Upper bound; omit when the limit is unknown. */
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  variant?: 'grouped' | 'outline';
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const upper = max && max > 0 ? max : Number.MAX_SAFE_INTEGER;
  const clamp = (next: number) => Math.min(upper, Math.max(1, next));
  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(parsed) && clamp(parsed) !== value)
      onChange(clamp(parsed));
  };
  const grouped = variant === 'grouped';

  const input = (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={(event) =>
        setDraft(event.target.value.replace(/\D/g, '').slice(0, 4))
      }
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') setDraft(null);
        else if (event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(clamp(value + 1));
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(clamp(value - 1));
        }
      }}
      className={cn(
        'min-w-0 rounded-md bg-transparent text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50',
        grouped ? 'h-8 w-9 font-semibold' : 'h-8 w-9 text-sm font-medium',
      )}
    />
  );

  const decrease = {
    'aria-label': `Decrease ${lowerFirst(label)}`,
    disabled: disabled || value <= 1,
    onClick: () => onChange(clamp(value - 1)),
  };
  const increase = {
    'aria-label': `Increase ${lowerFirst(label)}`,
    disabled: disabled || value >= upper,
    onClick: () => onChange(clamp(value + 1)),
  };

  if (grouped)
    return (
      <div
        className={cn(
          'flex items-center gap-1 rounded-lg border bg-background p-1',
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          {...decrease}
        >
          <Minus aria-hidden="true" className="size-4" />
        </Button>
        {input}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          {...increase}
        >
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      </div>
    );

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 rounded-md"
        {...decrease}
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </Button>
      {input}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 rounded-md"
        {...increase}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  );
}
