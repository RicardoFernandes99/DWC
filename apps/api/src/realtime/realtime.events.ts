export interface ServerToClientEvents {
  'notification.created': (payload: NotificationCreatedPayload) => void;
}

export type ClientToServerEvents = Record<never, never>;

export type InterServerEvents = Record<never, never>;

export interface SocketData {
  userId: string;
}

export interface NotificationCreatedPayload {
  notificationId: string;
}
