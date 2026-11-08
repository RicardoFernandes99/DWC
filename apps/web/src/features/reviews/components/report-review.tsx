import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Check, Flag, MoreHorizontal } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';
import {
  REPORT_NOTE_MAX,
  producerReviewsRoot,
  reportCategories,
  reportReview,
  type ReportCategory,
} from '../review-queries';

export function ReportReview({
  reviewId,
  producerId,
}: {
  reviewId: string;
  producerId: string;
}) {
  const session = useQuery(sessionOptions);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string>();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: (selected: ReportCategory) =>
      reportReview(reviewId, {
        category: selected,
        note: note.trim() || undefined,
      }),
    onMutate: () => setMessage(undefined),
    onError: (error) => {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 403) setMessage("You can't report your own review.");
      else if (status === 404) {
        setMessage('This review is no longer available.');
        void queryClient.invalidateQueries({
          queryKey: producerReviewsRoot(producerId),
        });
      } else
        setMessage(
          status === 401
            ? 'Please sign in again to report this review.'
            : 'The report could not be sent. Your answers are kept; try again.',
        );
    },
  });
  const user = session.data;
  if (session.isPending || user?.role === 'admin') return null;
  const menu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Review options"
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-accent"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-44 rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {user ? (
            <DropdownMenu.Item
              onSelect={() => setOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-accent"
            >
              <Flag aria-hidden="true" className="size-4" /> Report review
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Item asChild>
              <Link
                to="/login"
                search={{
                  returnTo: `${window.location.pathname}${window.location.search}`,
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-accent"
              >
                <Flag aria-hidden="true" className="size-4" /> Sign in to report
              </Link>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
  if (mutation.isSuccess)
    return (
      <p
        role="status"
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary"
      >
        <Check aria-hidden="true" className="size-4" />
        Thanks — we’ve received your report.
      </p>
    );
  if (!open || !user) return menu;
  return (
    <>
      {menu}
      <form
        className="mt-3 space-y-4 rounded-lg border bg-background p-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (category && !mutation.isPending) mutation.mutate(category);
        }}
      >
        {' '}
        <fieldset disabled={mutation.isPending} className="space-y-1">
          <legend className="font-medium">
            Why are you reporting it?{' '}
            <span className="font-normal text-muted-foreground">
              (required)
            </span>
          </legend>
          {reportCategories.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                name={`report-${reviewId}`}
                value={option.value}
                checked={category === option.value}
                onChange={() => setCategory(option.value)}
                className="size-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor={`report-note-${reviewId}`} className="font-medium">
            Note{' '}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Textarea
            id={`report-note-${reviewId}`}
            maxLength={REPORT_NOTE_MAX}
            value={note}
            disabled={mutation.isPending}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="text-xs tabular-nums text-muted-foreground">
            {note.length}/{REPORT_NOTE_MAX}
          </p>
        </div>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={!category || mutation.isPending}>
            {mutation.isPending
              ? 'Sending…'
              : mutation.isError
                ? 'Try again'
                : 'Send report'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}
