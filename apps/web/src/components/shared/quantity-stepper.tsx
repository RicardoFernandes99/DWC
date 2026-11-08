import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Quantity control with − / + buttons and a typed value. The typed value is
 * committed on blur or Enter and clamped to [1, max].
 */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled = false,
  label = 'Quantity',
  size = 'md',
  className,
}: {
  value: number;
  /** Upper bound; omit when the limit is unknown. */
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
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
  const height = size === 'lg' ? 'h-12' : size === 'sm' ? 'h-8' : 'h-10';
  const button = cn(
    'grid w-9 shrink-0 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
    height,
  );

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-lg border bg-background',
        disabled && 'opacity-60',
        className,
      )}
    >
      <button
        type="button"
        className={button}
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
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
          }
          if (event.key === 'Escape') setDraft(null);
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            onChange(clamp(value + 1));
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onChange(clamp(value - 1));
          }
        }}
        className={cn(
          'w-11 min-w-0 border-x bg-transparent text-center font-semibold tabular-nums outline-none focus:bg-card',
          height,
          size === 'sm' && 'text-sm',
        )}
      />
      <button
        type="button"
        className={button}
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={disabled || value >= upper}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
