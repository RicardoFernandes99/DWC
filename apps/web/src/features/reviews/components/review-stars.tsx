import { useId } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ratingWords } from '../review-queries';

const scale = [1, 2, 3, 4, 5] as const;

/** Read-only stars with a text equivalent. */
export function StarsDisplay({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {scale.map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={cn(
            'size-4',
            value <= rounded
              ? 'fill-primary text-primary'
              : 'text-muted-foreground/60',
          )}
        />
      ))}
    </span>
  );
}

/** Star input: five native radios in a fieldset; arrow keys move the choice. */
export function StarsInput({
  value,
  onChange,
  disabled,
  legend = 'Your rating',
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  legend?: string;
}) {
  const name = useId();
  const word = value ? ratingWords[value - 1] : undefined;
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">
        {legend} <span className="text-muted-foreground">(required)</span>
      </legend>
      <div className="flex flex-wrap items-center gap-1">
        {scale.map((star) => (
          <label
            key={star}
            className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 motion-reduce:transition-none"
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {star} {star === 1 ? 'star' : 'stars'}
            </span>
            <Star
              aria-hidden="true"
              className={cn(
                'size-7 transition-transform duration-150 ease-out peer-active:scale-90 motion-reduce:transition-none',
                star <= value
                  ? 'fill-primary text-primary'
                  : 'text-muted-foreground',
              )}
            />
          </label>
        ))}
        <p
          aria-live="polite"
          className="ml-2 text-sm tabular-nums text-muted-foreground"
        >
          {word ? `${value} of 5 · ${word}` : 'Choose 1 to 5 stars'}
        </p>
      </div>
    </fieldset>
  );
}
