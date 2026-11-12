import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import type {
  ClientToServerEvents,
  NotificationCreatedPayload,
  ServerToClientEvents,
} from '@dwc/realtime-contracts';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import {
  getAccessToken,
  refresh,
  subscribeAccessToken,
  type User,
} from '@/lib/session';
import {
  findNotification,
  notificationKey,
  unreadCountKey,
  unreadCountOptions,
  type Notification,
} from '../notifications';
import { NotificationLink } from './notification-link';
import { NotificationMenu } from './notification-menu';
import './notifications.css';

type ToastItem = Notification | { id: string; title: string; message: string };
const sessionKey = ['session'] as const;

function isNotificationCreatedPayload(
  value: unknown,
): value is NotificationCreatedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'notificationId' in value &&
    typeof value.notificationId === 'string' &&
    /^[a-f\d]{24}$/i.test(value.notificationId)
  );
}

function NotificationToast({
  toast,
  user,
  onDismiss,
}: {
  toast: ToastItem;
  user: User;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), 7000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, paused, toast.id]);
  return (
    <article
      className="notification-toast"
      role="status"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <div>
        <h2>{toast.title}</h2>
        <p>{toast.message}</p>
        {'resource' in toast ? (
          <NotificationLink notification={toast} role={user.role} />
        ) : (
          <Link to="/notifications" className="notification-resource-link">
            Open inbox
          </Link>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <span aria-hidden="true">×</span>
      </Button>
    </article>
  );
}

export function NotificationRuntime({ user }: { user: User }) {
  const client = useQueryClient();
  const unread = useQuery(unreadCountOptions(user.id));
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seen = useRef(new Set<string>());
  const sessionEpoch = useRef(0);
  const unreadCount = unread.data?.count ?? 0;
  const dismissToast = (id: string) =>
    setToasts((current) => current.filter((item) => item.id !== id));

  useEffect(() => {
    let active = true;
    let refreshingHandshake = false;
    let retryTimer: number | undefined;
    let retryDelay = 2000;
    let updateToken: (token: string | undefined) => void = () => {};
    const markServerStateStale = () => {
      void Promise.all([
        client.invalidateQueries({ queryKey: notificationKey(user.id) }),
        client.invalidateQueries({ queryKey: unreadCountKey(user.id) }),
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({
          queryKey: ['producer-application', user.id],
        }),
        client.invalidateQueries({ queryKey: sessionKey }),
      ]);
    };
    const showNotification = (
      notification: Notification | undefined,
      id: string,
    ) => {
      const fallback: ToastItem = {
        id,
        title: 'New notification',
        message: 'Open your inbox to view the latest update.',
      };
      setToasts((current) =>
        [
          ...(notification ? [notification] : [fallback]),
          ...current.filter((item) => item.id !== id),
        ].slice(0, 3),
      );
    };
    const onCreated = (payload: NotificationCreatedPayload) => {
      if (!isNotificationCreatedPayload(payload)) return;
      if (seen.current.has(payload.notificationId)) return;
      seen.current.add(payload.notificationId);
      const eventEpoch = sessionEpoch.current;
      markServerStateStale();
      void findNotification(payload.notificationId)
        .then((notification) => {
          if (
            active &&
            eventEpoch === sessionEpoch.current &&
            client.getQueryData<User | null>(sessionKey)?.id === user.id
          )
            showNotification(notification, payload.notificationId);
        })
        .catch(() => {
          if (
            active &&
            eventEpoch === sessionEpoch.current &&
            client.getQueryData<User | null>(sessionKey)?.id === user.id
          )
            showNotification(undefined, payload.notificationId);
        });
    };
    const createdSocket = io({
      autoConnect: false,
      auth: (callback) => callback({ accessToken: getAccessToken() ?? '' }),
      reconnection: true,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;
    const refreshSocketSession = async () => {
      if (!active || refreshingHandshake) return false;
      refreshingHandshake = true;
      try {
        const currentToken = getAccessToken();
        const auth = await refresh();
        if (!active || !getAccessToken()) return false;
        if (auth.accessToken === currentToken) updateToken(auth.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshingHandshake = false;
      }
    };
    const scheduleServiceRetry = () => {
      if (retryTimer !== undefined || !active) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void refreshSocketSession().then((attempted) => {
          if (!attempted && active) scheduleServiceRetry();
        });
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };
    const onConnect = () => {
      retryDelay = 2000;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      markServerStateStale();
    };
    const recover = () => {
      markServerStateStale();
      if (!createdSocket.connected && !createdSocket.active) {
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
        retryTimer = undefined;
        void refreshSocketSession();
      }
    };
    createdSocket.on('notification.created', onCreated);
    createdSocket.on('connect', onConnect);
    createdSocket.on('connect_error', (error) => {
      const code = (error as Error & { data?: { code?: string } }).data?.code;
      if (code === 'unauthorized') void refreshSocketSession();
      if (code === 'service_unavailable') scheduleServiceRetry();
    });
    updateToken = (token: string | undefined) => {
      if (!token) {
        sessionEpoch.current += 1;
        seen.current.clear();
        setToasts([]);
        createdSocket.disconnect();
        void client.cancelQueries();
        client.setQueryData(sessionKey, null);
        client.removeQueries({
          predicate: (query) => query.queryKey[0] !== sessionKey[0],
        });
        return;
      }
      createdSocket.auth = (callback) => callback({ accessToken: token });
      createdSocket.disconnect();
      createdSocket.connect();
    };
    const unsubscribe = subscribeAccessToken(updateToken);
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    if (getAccessToken()) updateToken(getAccessToken());
    else void refresh().catch(() => undefined);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
      createdSocket.off('notification.created', onCreated);
      createdSocket.off('connect', onConnect);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      createdSocket.disconnect();
    };
  }, [client, user.id]);

  return (
    <>
      <NotificationMenu user={user} unreadCount={unreadCount} />
      <section
        className="notification-toasts"
        aria-label="New notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <NotificationToast
            key={toast.id}
            toast={toast}
            user={user}
            onDismiss={dismissToast}
          />
        ))}
      </section>
      {unread.isError && (
        <span className="sr-only" role="status">
          Unread notification count could not be refreshed.
        </span>
      )}
    </>
  );
}
