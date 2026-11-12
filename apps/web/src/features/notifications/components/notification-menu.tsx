import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { authenticatedRequest, type User } from '@/lib/session';
import { cn } from '@/lib/utils';
import {
  notificationKey,
  unreadCountKey,
  type Notification,
  type NotificationPage,
} from '../notifications';
import { NotificationLink } from './notification-link';

const PREVIEW_LIMIT = 5;

function timeAgo(value: string) {
  const then = new Date(value).valueOf();
  if (Number.isNaN(then)) return 'Recently';
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    then,
  );
}

/** Header bell that opens the latest notifications. */
export function NotificationMenu({
  user,
  unreadCount,
}: {
  user: User;
  unreadCount: number;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const preview = useQuery({
    // Nested under the inbox key so existing invalidations refresh it too.
    queryKey: [...notificationKey(user.id), 'preview'],
    queryFn: () =>
      authenticatedRequest<NotificationPage>(
        `notifications?limit=${PREVIEW_LIMIT}`,
      ),
    enabled: open,
    staleTime: 0,
  });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      authenticatedRequest<Notification>(
        `notifications/${encodeURIComponent(id)}/read`,
        { method: 'PATCH' },
      ),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: notificationKey(user.id) }),
        client.invalidateQueries({ queryKey: unreadCountKey(user.id) }),
      ]),
  });
  const items = preview.data?.items ?? [];
  const hasMore = Boolean(preview.data?.nextCursor);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="notification-nav-link data-[state=open]:bg-card data-[state=open]:shadow-xs"
          aria-label={
            unreadCount
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell aria-hidden="true" className="notification-bell" />
          {Boolean(unreadCount) && (
            <span className="notification-count" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {Boolean(unreadCount) && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>
        {preview.isPending ? (
          <ul aria-label="Loading notifications" className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="h-10 animate-pulse rounded-md bg-secondary motion-reduce:animate-none"
              />
            ))}
          </ul>
        ) : preview.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Notifications could not load.
          </p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {items.map((notification) => {
              const unread = !notification.readAt;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    'relative flex gap-3 px-4 py-3',
                    unread && 'bg-secondary/40',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      unread ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        unread ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <time dateTime={notification.createdAt}>
                        {timeAgo(notification.createdAt)}
                      </time>
                      <NotificationLink
                        notification={notification}
                        role={user.role}
                        onNavigate={() => {
                          if (unread) markRead.mutate(notification.id);
                          setOpen(false);
                        }}
                      />
                      {unread && (
                        <button
                          type="button"
                          className="ml-auto font-medium text-primary hover:underline"
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate(notification.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
          >
            {hasMore ? 'See all notifications' : 'Open notifications'}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
