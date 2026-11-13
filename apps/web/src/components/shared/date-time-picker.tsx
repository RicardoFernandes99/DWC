import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const pad = (value: number) => String(value).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, step) => pad(step * 5));
const DEFAULT_TIME = '09:00';

const labelFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Splits a `YYYY-MM-DDTHH:mm` local value; anything else counts as empty. */
function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match;
  return {
    date: new Date(Number(year), Number(month) - 1, Number(day)),
    hour: hour!,
    minute: minute!,
  };
}

function toValue(date: Date, hour: string, minute: string) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hour}:${minute}`;
}

/**
 * Date and time field that replaces the browser's `datetime-local` picker.
 * The value keeps the same `YYYY-MM-DDTHH:mm` local format, so callers
 * convert it exactly as before.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
  placeholder = 'Pick a date and time',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parse(value);
  const [defaultHour, defaultMinute] = DEFAULT_TIME.split(':') as [
    string,
    string,
  ];
  const hour = parsed?.hour ?? defaultHour;
  const minute = parsed?.minute ?? defaultMinute;
  // Keep an existing off-step minute (for example from the server) selectable.
  const minutes = MINUTE_STEPS.includes(minute)
    ? MINUTE_STEPS
    : [...MINUTE_STEPS, minute].sort();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            !parsed && 'text-muted-foreground',
          )}
        >
          <CalendarDays
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate tabular-nums">
            {parsed
              ? `${labelFormatter.format(parsed.date)}, ${parsed.hour}:${parsed.minute}`
              : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Match the field's width (at least 18rem) so the calendar lines up with it.
        className="w-[max(var(--radix-popover-trigger-width),18rem)] p-0"
      >
        <Calendar
          mode="single"
          selected={parsed?.date}
          defaultMonth={parsed?.date ?? today}
          disabled={{ before: today }}
          weekStartsOn={1}
          onSelect={(date) => {
            if (date) onChange(toValue(date, hour, minute));
          }}
          className="w-full p-3 [--cell-size:calc((max(var(--radix-popover-trigger-width),18rem)-1.5rem)/7)]"
        />
        <div className="flex items-center gap-2 border-t p-3">
          <span className="mr-auto text-sm font-medium">Time</span>
          <TimeSelect
            label="Hour"
            value={hour}
            options={HOURS}
            onChange={(next) =>
              onChange(toValue(parsed?.date ?? today, next, minute))
            }
          />
          <span aria-hidden="true">:</span>
          <TimeSelect
            label="Minute"
            value={minute}
            options={minutes}
            onChange={(next) =>
              onChange(toValue(parsed?.date ?? today, hour, next))
            }
          />
          <Button size="sm" className="ml-1" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Native select: a portal-based dropdown inside the popover would be treated
 * as an outside click and lose the selection.
 */
function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      wrapperClassName="w-[4.5rem]"
      className="h-9 tabular-nums"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </NativeSelect>
  );
}
