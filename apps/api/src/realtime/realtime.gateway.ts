import {
  OnModuleDestroy,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { HttpException } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import type {
  ClientToServerEvents,
  InterServerEvents,
  NotificationCreatedPayload,
  ServerToClientEvents,
  SocketData,
} from './realtime.events.js';

type PersonalSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

class HandshakeError extends Error {
  readonly data: {
    code: 'unauthorized' | 'service_unavailable' | 'origin_not_allowed';
  };

  constructor(
    code: 'unauthorized' | 'service_unavailable' | 'origin_not_allowed',
  ) {
    super(code);
    this.data = { code };
  }
}

@WebSocketGateway()
export class RealtimeGateway
  implements
    OnGatewayInit<RealtimeServer>,
    OnGatewayConnection<PersonalSocket>,
    OnGatewayDisconnect<PersonalSocket>,
    OnModuleDestroy
{
  @WebSocketServer()
  private server!: RealtimeServer;

  private readonly webOrigin: string;
  private readonly socketsByUser = new Map<string, Set<PersonalSocket>>();

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
  }

  afterInit(server: RealtimeServer) {
    server.use((socket, next) => {
      void this.authenticateHandshake(socket)
        .then(() => next())
        .catch((error: unknown) => {
          next(this.handshakeError(error));
        });
    });
  }

  async handleConnection(socket: PersonalSocket) {
    const { userId } = socket.data;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const room = this.userRoom(userId);
    try {
      await socket.join(room);
    } catch {
      socket.disconnect(true);
      return;
    }
    if (!socket.connected) return;
    const sockets = this.socketsByUser.get(userId) ?? new Set<PersonalSocket>();
    sockets.add(socket);
    this.socketsByUser.set(userId, sockets);
  }

  handleDisconnect(socket: PersonalSocket) {
    const { userId } = socket.data;
    if (!userId) return;
    const sockets = this.socketsByUser.get(userId);
    sockets?.delete(socket);
    if (sockets?.size === 0) this.socketsByUser.delete(userId);
  }

  async publishNotificationCreated(
    userId: string,
    payload: NotificationCreatedPayload,
  ) {
    if (!/^[0-9a-f]{24}$/.test(userId)) return;
    if (!/^[0-9a-f]{24}$/.test(payload.notificationId)) return;

    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return;
    for (const socket of [...sockets]) {
      try {
        const currentUser = await this.auth.authenticate(
          `Bearer ${socket.data.accessToken}`,
        );
        if (currentUser.id !== userId || socket.data.userId !== userId) {
          socket.disconnect(true);
          continue;
        }
        if (!socket.connected) continue;
        socket.emit('notification.created', payload);
      } catch {
        socket.disconnect(true);
      }
    }
  }

  onModuleDestroy() {
    for (const sockets of this.socketsByUser.values()) {
      for (const socket of sockets) socket.disconnect(true);
    }
    this.socketsByUser.clear();
  }

  private async authenticateHandshake(socket: PersonalSocket) {
    const origin = socket.handshake.headers.origin;
    if (origin && origin !== this.webOrigin) {
      throw new HandshakeError('origin_not_allowed');
    }
    const auth: unknown = socket.handshake.auth;
    if (
      typeof auth !== 'object' ||
      auth === null ||
      !('accessToken' in auth) ||
      typeof auth.accessToken !== 'string' ||
      auth.accessToken.length > 2000 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth.accessToken)
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.auth.authenticate(`Bearer ${auth.accessToken}`);
    socket.data.userId = user.id;
    socket.data.accessToken = auth.accessToken;
  }

  private handshakeError(error: unknown) {
    if (error instanceof HandshakeError) return error;
    if (
      error instanceof ServiceUnavailableException ||
      (this.isHttpException(error) && error.getStatus() >= 500)
    ) {
      return new HandshakeError('service_unavailable');
    }
    return new HandshakeError('unauthorized');
  }

  private isHttpException(error: unknown): error is HttpException {
    return (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    );
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
