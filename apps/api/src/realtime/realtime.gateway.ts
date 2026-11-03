import {
  OnModuleDestroy,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
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
    OnModuleDestroy
{
  @WebSocketServer()
  private server!: RealtimeServer;

  private readonly webOrigin: string;

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
  }

  publishNotificationCreated(
    userId: string,
    payload: NotificationCreatedPayload,
  ) {
    if (!/^[0-9a-f]{24}$/.test(userId)) return;
    if (!/^[0-9a-f]{24}$/.test(payload.notificationId)) return;

    this.server.to(this.userRoom(userId)).emit('notification.created', payload);
  }

  onModuleDestroy() {
    this.server.disconnectSockets(true);
  }

  private async authenticateHandshake(socket: PersonalSocket) {
    const origin = socket.handshake.headers.origin;
    if (origin && origin !== this.webOrigin) {
      throw new HandshakeError('origin_not_allowed');
    }
    const accessToken: unknown = socket.handshake.auth?.accessToken;
    if (typeof accessToken !== 'string') {
      throw new UnauthorizedException();
    }

    const user = await this.auth.authenticate(`Bearer ${accessToken}`);
    socket.data.userId = user.id;
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
