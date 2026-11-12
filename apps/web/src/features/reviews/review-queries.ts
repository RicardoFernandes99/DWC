import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { authenticatedRequest, publicRequest } from '@/lib/session';

export type ProducerReviewList = components['schemas']['ProducerReviewListDto'];
export type OwnReview = components['schemas']['OwnReviewDto'];
export type OrderReviewStatus = components['schemas']['OrderReviewStatusDto'];
export type ReportCategory =
  components['schemas']['ReportReviewDto']['category'];

export const REVIEW_PAGE_SIZE = 10;
export const REVIEW_COMMENT_MAX = 1000;
export const REPORT_NOTE_MAX = 500;

export const producerReviewsRoot = (producerId: string) =>
  ['reviews', 'producer', producerId] as const;

export const producerReviewsOptions = (producerId: string, page: number) =>
  queryOptions({
    queryKey: [...producerReviewsRoot(producerId), page] as const,
    queryFn: () =>
      publicRequest<ProducerReviewList>(
        `producers/${encodeURIComponent(producerId)}/reviews?page=${page}&limit=${REVIEW_PAGE_SIZE}`,
      ),
    placeholderData: keepPreviousData,
    retry: false,
  });

export const orderReviewKey = (orderId: string) =>
  ['reviews', 'order', orderId] as const;

export const orderReviewOptions = (orderId: string) =>
  queryOptions({
    queryKey: orderReviewKey(orderId),
    queryFn: () =>
      authenticatedRequest<OrderReviewStatus>(
        `reviews/orders/${encodeURIComponent(orderId)}`,
      ),
    retry: false,
  });

export const createReview = (body: components['schemas']['CreateReviewDto']) =>
  authenticatedRequest<OwnReview>('reviews', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const reportReview = (
  reviewId: string,
  body: components['schemas']['ReportReviewDto'],
) =>
  authenticatedRequest<components['schemas']['ReviewReportResultDto']>(
    `reviews/${encodeURIComponent(reviewId)}/reports`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const ratingWords = [
  'Poor',
  'Fair',
  'Good',
  'Very good',
  'Excellent',
] as const;

export const reportCategories: { value: ReportCategory; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'offensive', label: 'Offensive or abusive' },
  { value: 'off_topic', label: 'Off topic' },
  { value: 'false_information', label: 'False information' },
  { value: 'other', label: 'Something else' },
];

export function reviewDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export function errorCode(error: unknown): string | undefined {
  const data = (error as { data?: { code?: unknown } } | null)?.data;
  return typeof data?.code === 'string' ? data.code : undefined;
}
