import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { authenticatedRequest } from '@/lib/session';

export type Notification = components['schemas']['NotificationResponseDto'];
export type NotificationPage =
  components['schemas']['NotificationListResponseDto'];
type UnreadCount = components['schemas']['UnreadCountResponseDto'];

export const notificationKey = (userId: string) =>
  ['notifications', userId] as const;
export const unreadCountKey = (userId: string) =>
  ['notifications', userId, 'unread-count'] as const;

export const unreadCountOptions = (userId: string) =>
  queryOptions({
    queryKey: unreadCountKey(userId),
    queryFn: () =>
      authenticatedRequest<UnreadCount>('notifications/unread-count'),
    staleTime: 0,
  });

export const notificationPagesOptions = (userId: string) =>
  infiniteQueryOptions({
    queryKey: notificationKey(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ limit: '20' });
      if (pageParam) query.set('cursor', pageParam);
      return authenticatedRequest<NotificationPage>(
        `notifications?${query.toString()}`,
      );
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
  });

export async function findNotification(
  notificationId: string,
): Promise<Notification | undefined> {
  let cursor: string | undefined;
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    const page = await authenticatedRequest<NotificationPage>(
      `notifications?${query.toString()}`,
    );
    const match = page.items.find((item) => item.id === notificationId);
    if (match) return match;
    cursor = page.nextCursor ?? undefined;
    if (!cursor) return undefined;
  }
  return undefined;
}
