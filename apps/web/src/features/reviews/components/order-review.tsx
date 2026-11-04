import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/session';
import {
  REVIEW_COMMENT_MAX,
  createReview,
  errorCode,
  orderReviewKey,
  orderReviewOptions,
  producerReviewsRoot,
  reviewDate,
  type OrderReviewStatus,
  type OwnReview,
} from '../review-queries';
import { StarsDisplay, StarsInput } from './review-stars';

function reviewError(error: unknown) {
  const code = errorCode(error);
  if (code === 'review_exists') return "You've already reviewed this order.";
  if (code === 'order_not_reviewable')
    return 'This order cannot be reviewed yet. Reviews open once it is delivered or collected.';
  if (error instanceof ApiError && error.status === 404)
    return 'We could not find this order to review.';
  if (error instanceof ApiError && error.status === 400)
    return 'Check the rating and comment, then try again.';
  return 'Your review could not be sent. Your answers are kept; try again.';
}

function OwnReviewView({ review }: { review: OwnReview }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarsDisplay rating={review.rating} />
        <span className="text-sm tabular-nums text-muted-foreground">
          {review.rating} of 5 · {reviewDate(review.createdAt)}
        </span>
      </div>
      {review.comment && (
        <p className="max-w-prose break-words whitespace-pre-line text-sm leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}

export function OrderReview({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const status = useQuery(orderReviewOptions(orderId));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      createReview({
        orderId,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: (review) => {
      queryClient.setQueryData<OrderReviewStatus>(orderReviewKey(orderId), {
        eligible: false,
        review,
      });
      void queryClient.invalidateQueries({
        queryKey: producerReviewsRoot(review.producerId),
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409)
        void queryClient.invalidateQueries({
          queryKey: orderReviewKey(orderId),
        });
    },
  });
  const review = status.data?.review;
  const editable = status.data?.eligible && !review;
  return (
    <section
      className="mt-8 rounded-lg border bg-card p-5"
      aria-labelledby="order-review-title"
    >
      <h2 id="order-review-title">
        {review ? 'Your review' : 'Review this producer'}
      </h2>
      {status.isPending && (
        <div
          className="mt-4 h-20 animate-pulse rounded-md bg-secondary motion-reduce:animate-none"
          aria-busy="true"
          aria-label="Loading review"
        />
      )}
      {status.isError && !status.data && (
        <div role="alert" className="mt-3 space-y-3">
          <p className="text-sm text-destructive">
            Review status could not be loaded.
          </p>
          <Button
            variant="outline"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            {status.isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}
      {!editable && mutation.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {reviewError(mutation.error)}
        </p>
      )}
      {review && (
        <div className="mt-3">
          {mutation.isSuccess && (
            <p role="status" className="mb-3 text-sm text-primary">
              Thanks — your review is now on the producer’s page.
            </p>
          )}
          <OwnReviewView review={review} />
        </div>
      )}
      {status.data && !review && !status.data.eligible && (
        <p className="mt-3 text-sm text-muted-foreground">
          Reviews open once this order is delivered or collected.
        </p>
      )}
      {editable && (
        <form
          className="mt-3 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (rating && !mutation.isPending) mutation.mutate();
          }}
        >
          <p className="max-w-prose text-sm text-muted-foreground">
            Tell other buyers how it went. One review per order, shown publicly
            with your first name.
          </p>
          <StarsInput
            value={rating}
            onChange={setRating}
            disabled={mutation.isPending}
          />
          <div className="space-y-1.5">
            <label
              htmlFor={`review-comment-${orderId}`}
              className="text-sm font-medium"
            >
              Comment{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Textarea
              id={`review-comment-${orderId}`}
              maxLength={REVIEW_COMMENT_MAX}
              value={comment}
              disabled={mutation.isPending}
              onChange={(event) => setComment(event.target.value)}
            />
            <p className="text-xs tabular-nums text-muted-foreground">
              {comment.length}/{REVIEW_COMMENT_MAX}
            </p>
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {reviewError(mutation.error)}
            </p>
          )}
          <Button type="submit" disabled={!rating || mutation.isPending}>
            {mutation.isPending
              ? 'Sending…'
              : mutation.isError
                ? 'Try again'
                : 'Send review'}
          </Button>
        </form>
      )}
    </section>
  );
}
