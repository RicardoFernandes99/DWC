import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { producerReviewsOptions, reviewDate } from '../review-queries';
import { ReportReview } from './report-review';
import { StarsDisplay } from './review-stars';

/** Compact rating line for the producer header; never invents a rating. */
export function ProducerRatingSummary({ producerId }: { producerId: string }) {
  const { data, isPending } = useQuery(producerReviewsOptions(producerId, 1));
  if (isPending)
    return (
      <div className="mt-4 h-5 w-40 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
    );
  if (!data) return null;
  const { averageRating, ratingCount } = data.summary;
  return (
    <a
      href="#reviews"
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {averageRating === null || ratingCount === 0 ? (
        <span className="text-muted-foreground">No reviews yet</span>
      ) : (
        <>
          <StarsDisplay rating={averageRating} />
          <span className="tabular-nums">
            <strong className="font-semibold">
              {averageRating.toFixed(1)}
            </strong>{' '}
            · {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
          </span>
        </>
      )}
    </a>
  );
}

const COLLAPSED_REVIEWS = 4;

export function ProducerReviews({ producerId }: { producerId: string }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const query = useQuery(producerReviewsOptions(producerId, page));
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <section
      id="reviews"
      className="mt-12 scroll-mt-6 space-y-5"
      aria-labelledby="farm-reviews-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="farm-reviews-heading" className="text-2xl">
          Reviews
          {data && (
            <span className="ml-2 font-sans text-base font-normal text-muted-foreground tabular-nums">
              {data.total}
            </span>
          )}
        </h2>
      </div>
      {query.isPending && (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="Loading reviews"
        >
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-24 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
            />
          ))}
        </div>
      )}
      {query.isError && (
        <div role="alert" className="rounded-lg border p-4">
          <p className="text-sm text-destructive">
            {data
              ? 'Could not refresh reviews. Showing the last loaded page.'
              : 'Reviews could not be loaded.'}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}
      {data && data.total === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No reviews yet. Buyers can review this farm after a delivered or
          collected order.
        </p>
      )}
      {data && data.total > 0 && data.items.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <p>There are no reviews on this page any more.</p>
          <Button variant="outline" className="mt-3" onClick={() => setPage(1)}>
            Back to the first page
          </Button>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul
          className="grid gap-3 md:grid-cols-2"
          aria-busy={query.isPlaceholderData}
        >
          {(expanded ? data.items : data.items.slice(0, COLLAPSED_REVIEWS)).map(
            (review) => (
              <li
                key={review.id}
                className="relative rounded-lg border bg-card p-4 md:p-5"
              >
                <div className="flex items-center gap-3 pr-10">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
                  >
                    {review.reviewerFirstName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {review.reviewerFirstName}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarsDisplay rating={review.rating} />
                      <time
                        dateTime={review.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {reviewDate(review.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-3 break-words whitespace-pre-line leading-relaxed">
                    {review.comment}
                  </p>
                )}
                <ReportReview reviewId={review.id} producerId={producerId} />
              </li>
            ),
          )}
        </ul>
      )}
      {data && !expanded && data.items.length > COLLAPSED_REVIEWS && (
        <Button variant="outline" onClick={() => setExpanded(true)}>
          Show more reviews
        </Button>
      )}
      {data && expanded && totalPages > 1 && (
        <nav
          aria-label="Review pages"
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={page <= 1 || query.isPlaceholderData}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </Button>
          <p className="text-sm tabular-nums text-muted-foreground">
            Page {data.page} of {totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages || query.isPlaceholderData}
            onClick={() => setPage(page + 1)}
          >
            Next <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}
