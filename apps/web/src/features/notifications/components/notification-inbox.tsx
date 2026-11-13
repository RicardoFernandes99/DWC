import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Bell, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, authenticatedRequest, type User } from '@/lib/session';
import { NotificationLink } from './notification-link';
import {
  notificationKey,
  notificationPagesOptions,
  unreadCountKey,
  type Notification,
} from '../notifications';
import './notifications.css';
import { EmptyState } from '@/components/shared/empty-state';

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'Recently'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

export function NotificationInbox({ user }: { user: User }) {
  const client = useQueryClient();
  const [readError, setReadError] = useState('');
  const inbox = useInfiniteQuery(notificationPagesOptions(user.id));
  const markRead = useMutation({
    mutationFn: (id: string) =>
      authenticatedRequest<Notification>(
        `notifications/${encodeURIComponent(id)}/read`,
        { method: 'PATCH' },
      ),
    onMutate: () => setReadError(''),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: notificationKey(user.id) }),
        client.invalidateQueries({ queryKey: unreadCountKey(user.id) }),
      ]);
    },
    onError: (error) =>
      setReadError(
        error instanceof ApiError && error.status === 404
          ? 'This notification is no longer available.'
          : 'Could not mark this notification as read. Please try again.',
      ),
  });
  const items = inbox.data?.pages
    ? [
        ...new Map(
          inbox.data.pages
            .flatMap((page) => page.items)
            .map((notification) => [notification.id, notification]),
        ).values(),
      ]
    : [];

  return (
    <main className="notification-page">
      <div className="notification-page-heading">
        <div>
          <h1>Notifications</h1>
        </div>
      </div>
      {readError && (
        <p className="notification-error" role="alert">
          {readError}
        </p>
      )}
      {inbox.isPending ? (
        <p className="notification-state" role="status">
          Loading your notifications…
        </p>
      ) : inbox.isError && items.length === 0 ? (
        <Card className="notification-state-card">
          <RefreshCw aria-hidden="true" />
          <p>Notifications could not be loaded.</p>
          <Button variant="outline" onClick={() => void inbox.refetch()}>
            Try again
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="You’re all caught up"
          description="New order and application updates will appear here."
        />
      ) : (
        <>
          <ol className="notification-list" aria-label="Your notifications">
            {items.map((notification) => {
              const unread = notification.readAt === null;
              return (
                <li key={notification.id}>
                  <article
                    className="notification-row"
                    data-unread={unread ? 'true' : undefined}
                  >
                    <span
                      className="notification-unread-dot"
                      aria-hidden="true"
                    />
                    <div className="notification-row-copy">
                      <h2>
                        {unread && <span className="sr-only">Unread. </span>}
                        {notification.title}
                      </h2>
                      <p>{notification.message}</p>
                      <time dateTime={notification.createdAt}>
                        {displayDate(notification.createdAt)}
                      </time>
                    </div>
                    <div className="notification-row-actions">
                      <NotificationLink
                        notification={notification}
                        role={user.role}
                      />
                      {unread && (
                        <Button
                          variant="ghost"
                          className="min-h-11"
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate(notification.id)}
                          aria-label={`Mark “${notification.title}” as read`}
                        >
                          <Check aria-hidden="true" />
                          <span className="notification-mark-label">
                            Mark read
                          </span>
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
          {inbox.isError && (
            <div className="notification-error" role="alert">
              <p>
                Could not refresh the inbox. Showing the notifications already
                loaded.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={inbox.isFetching}
                onClick={() => void inbox.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {inbox.hasNextPage && (
            <div className="notification-more">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={inbox.isFetchingNextPage}
                onClick={() => void inbox.fetchNextPage()}
              >
                <ChevronDown aria-hidden="true" />
                {inbox.isFetchingNextPage
                  ? 'Loading…'
                  : 'Show older notifications'}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
