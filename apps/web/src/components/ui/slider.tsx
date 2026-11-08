// Adapted from shadcn/ui (MIT); see docs/licenses/shadcn-ui.txt.
import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels = [],
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Accessible name for each thumb, in order. */
  thumbLabels?: string[];
}) {
  const values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center py-2 select-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-primary"
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={thumbLabels[index]}
          className="relative block size-5 shrink-0 rounded-full border-2 border-primary bg-card shadow-sm ring-ring/40 transition-[box-shadow] after:absolute after:-inset-2 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden motion-reduce:transition-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
