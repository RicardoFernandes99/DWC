import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

/** Upper slider bound; the top position means "no maximum". */
const PRICE_CEILING_CENTS = 3000;
const PRICE_STEP_CENTS = 50;

const euros = (cents: number) =>
  `€${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const describe = (from: number, to: number) =>
  from === 0 && to === PRICE_CEILING_CENTS
    ? 'Any price'
    : to === PRICE_CEILING_CENTS
      ? `${euros(from)}+`
      : `${euros(from)} – ${euros(to)}`;

type PriceProps = {
  minCents: number | undefined;
  maxCents: number | undefined;
  onCommit: (min: number | undefined, max: number | undefined) => void;
};

/**
 * Two-thumb price slider; the top position means "no maximum". Remount it
 * (via `key`) when the URL range changes so the draft follows.
 */
export function PriceSlider({ minCents, maxCents, onCommit }: PriceProps) {
  const [range, setRange] = useState([
    Math.min(minCents ?? 0, PRICE_CEILING_CENTS),
    Math.min(maxCents ?? PRICE_CEILING_CENTS, PRICE_CEILING_CENTS),
  ]);
  const [low, high] = range as [number, number];
  return (
    <div>
      <p className="mb-4 text-right text-sm tabular-nums text-muted-foreground">
        {describe(low, high)}
      </p>
      <Slider
        min={0}
        max={PRICE_CEILING_CENTS}
        step={PRICE_STEP_CENTS}
        minStepsBetweenThumbs={1}
        value={range}
        thumbLabels={['Minimum price', 'Maximum price']}
        onValueChange={setRange}
        onValueCommit={([from, to]) =>
          onCommit(
            from ? from : undefined,
            to === undefined || to >= PRICE_CEILING_CENTS ? undefined : to,
          )
        }
      />
      <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>€0</span>
        <span>{euros(PRICE_CEILING_CENTS)}+</span>
      </div>
    </div>
  );
}

export function SearchControl({
  initialValue,
  from,
  field = 'q',
  placeholder,
  className,
}: {
  initialValue: string;
  from: '/products' | '/farm/$producerId';
  field?: 'q' | 'location';
  placeholder: string;
  className: string;
}) {
  const navigate = useNavigate({ from });
  const [urlValue, setUrlValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  if (urlValue !== initialValue) {
    setUrlValue(initialValue);
    setDraft(initialValue);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = draft.trim().slice(0, 100);
      if (value !== initialValue)
        void navigate({
          search: (previous) => ({
            ...previous,
            [field]: value || undefined,
            page: 1,
          }),
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, field, initialValue, navigate]);
  return (
    <Input
      value={draft}
      maxLength={100}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
