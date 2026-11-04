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

export function ProducerReviews({ producerId }: { producerId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery(producerReviewsOptions(producerId, page));
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <section
      id="reviews"
      className="mt-10 scroll-mt-6 space-y-4 border-t pt-8"
      aria-labelledby="farm-reviews-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="farm-reviews-heading" className="text-2xl">
          Reviews
        </h2>
        {data && data.summary.ratingCount > 0 && (
          <p className="text-sm tabular-nums text-muted-foreground">
            {data.summary.averageRating?.toFixed(1)} average from{' '}
            {data.summary.ratingCount}{' '}
            {data.summary.ratingCount === 1 ? 'review' : 'reviews'}
          </p>
        )}
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
          className="divide-y rounded-lg border bg-card"
          aria-busy={query.isPlaceholderData}
        >
          {data.items.map((review) => (
            <li key={review.id} className="space-y-2 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StarsDisplay rating={review.rating} />
                <span className="font-medium">{review.reviewerFirstName}</span>
                <time
                  dateTime={review.createdAt}
                  className="text-sm text-muted-foreground"
                >
                  {reviewDate(review.createdAt)}
                </time>
              </div>
              {review.comment && (
                <p className="max-w-3xl break-words whitespace-pre-line leading-relaxed">
                  {review.comment}
                </p>
              )}
              <ReportReview reviewId={review.id} producerId={producerId} />
            </li>
          ))}
        </ul>
      )}
      {data && totalPages > 1 && (
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
