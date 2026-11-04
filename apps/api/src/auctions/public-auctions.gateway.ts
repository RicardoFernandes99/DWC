import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { HttpException } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { UserRole } from '../users/user.schema.js';
import { AuctionBidRequestDto, AuctionRoomRequestDto } from './auction.dto.js';
import { AuctionsService } from './auctions.service.js';
import { AuctionCompletionPublisher } from './auction-completion.publisher.js';
import type { AuctionCompletionPayload } from './auction-completion.publisher.js';
import type {
  AuctionBidAcknowledgement,
  AuctionJoinAcknowledgement,
  AuctionLeaveAcknowledgement,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
} from '../realtime/realtime.events.js';

type AuctionSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  Record<never, never>
>;

type AuctionNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  Record<never, never>
>;

interface AuctionSocketData {
  joinedAuctions: Set<string>;
}

@WebSocketGateway({ namespace: '/auctions' })
export class PublicAuctionsGateway
  implements
    OnGatewayInit<AuctionNamespace>,
    OnGatewayConnection<AuctionSocket>,
    OnGatewayDisconnect<AuctionSocket>,
    OnModuleDestroy
{
  @WebSocketServer()
  private namespace!: AuctionNamespace;

  private readonly webOrigin: string;
  private readonly sockets = new Map<string, AuctionSocketData>();
  private readonly bidWindows = new Map<string, number[]>();

  constructor(
    private readonly auctions: AuctionsService,
    private readonly auth: AuthService,
    completion: AuctionCompletionPublisher,
    config: ConfigService,
  ) {
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
    completion.bind((payload) => this.publishCompletion(payload));
  }

  private publishCompletion(payload: AuctionCompletionPayload): void {
    this.namespace
      ?.to(this.room(payload.auctionId))
      .emit('auction.closed', payload);
  }

  afterInit(namespace: AuctionNamespace) {
    namespace.use((socket, next) => {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== this.webOrigin) {
        next(new Error('origin_not_allowed'));
        return;
      }
      next();
    });
  }

  handleConnection(socket: AuctionSocket) {
    this.sockets.set(socket.id, {
      joinedAuctions: new Set(),
    });
    socket.on('auction.join', (payload, acknowledge) => {
      void this.join(socket, payload, acknowledge).catch(() => {
        this.acknowledger(acknowledge)({
          ok: false,
          code: 'service_unavailable',
        });
      });
    });
    socket.on('auction.leave', (payload, acknowledge) => {
      void this.leave(socket, payload, acknowledge).catch(() => {
        this.acknowledger(acknowledge)({ ok: false, code: 'invalid_input' });
      });
    });
    socket.on('auction.bid', (payload, acknowledge) => {
      void this.bid(socket, payload, acknowledge).catch(() => {
        this.acknowledger(acknowledge)({
          ok: false,
          code: 'service_unavailable',
          message: 'Bidding is temporarily unavailable. Try again shortly.',
        });
      });
    });
  }

  async handleDisconnect(socket: AuctionSocket) {
    const data = this.sockets.get(socket.id);
    this.sockets.delete(socket.id);
    if (!data) return;
    for (const auctionId of data.joinedAuctions) {
      await this.publishViewerCount(auctionId);
    }
  }

  onModuleDestroy() {
    this.namespace.disconnectSockets(true);
    this.sockets.clear();
    this.bidWindows.clear();
  }

  private async join(
    socket: AuctionSocket,
    input: unknown,
    acknowledge: (result: AuctionJoinAcknowledgement) => void,
  ) {
    const ack = this.acknowledger(acknowledge);
    const request = await this.validatePayload(AuctionRoomRequestDto, input);
    if (!request) {
      ack({ ok: false, code: 'invalid_input' });
      return;
    }
    request.auctionId = request.auctionId.toLowerCase();
    const connected = this.sockets.get(socket.id);
    if (!connected) {
      ack({ ok: false, code: 'service_unavailable' });
      return;
    }
    if (
      !connected.joinedAuctions.has(request.auctionId) &&
      connected.joinedAuctions.size >= 20
    ) {
      ack({ ok: false, code: 'service_unavailable' });
      return;
    }
    const room = this.room(request.auctionId);
    let joined = false;
    try {
      await this.auctions.getLiveState(request.auctionId, 0);
      await socket.join(room);
      connected.joinedAuctions.add(request.auctionId);
      joined = true;
      const state = await this.auctions.getLiveState(
        request.auctionId,
        this.viewerCount(request.auctionId),
      );
      this.namespace.to(room).emit('auction.state', state);
      ack({ ok: true, state });
    } catch (error) {
      if (joined) {
        await socket.leave(room);
        connected.joinedAuctions.delete(request.auctionId);
      }
      ack({
        ok: false,
        code:
          error instanceof NotFoundException
            ? 'not_found'
            : 'service_unavailable',
      });
    }
  }

  private async leave(
    socket: AuctionSocket,
    input: unknown,
    acknowledge: (result: AuctionLeaveAcknowledgement) => void,
  ) {
    const ack = this.acknowledger(acknowledge);
    const request = await this.validatePayload(AuctionRoomRequestDto, input);
    if (!request) {
      ack({ ok: false, code: 'invalid_input' });
      return;
    }
    request.auctionId = request.auctionId.toLowerCase();
    await socket.leave(this.room(request.auctionId));
    this.sockets.get(socket.id)?.joinedAuctions.delete(request.auctionId);
    ack({ ok: true, auctionId: request.auctionId });
    await this.publishViewerCount(request.auctionId);
  }

  private async bid(
    socket: AuctionSocket,
    input: unknown,
    acknowledge: (result: AuctionBidAcknowledgement) => void,
  ) {
    const ack = this.acknowledger(acknowledge);
    const body = this.asRecord(input);
    if (
      !body ||
      typeof body.accessToken !== 'string' ||
      body.accessToken.length > 2000
    ) {
      ack({
        ok: false,
        code: 'unauthorized',
        message: 'Sign in again to bid.',
      });
      return;
    }
    const { accessToken, ...payload } = body;
    const request = await this.validatePayload(AuctionBidRequestDto, payload);
    if (!request) {
      ack({
        ok: false,
        code: 'invalid_input',
        message: 'Check the bid details and try again.',
      });
      return;
    }
    request.auctionId = request.auctionId.toLowerCase();

    try {
      const buyer = await this.auth.authenticate(`Bearer ${accessToken}`);
      if (buyer.role !== UserRole.Buyer) {
        ack({
          ok: false,
          code: 'forbidden',
          message: 'Buyer access is required to bid.',
        });
        return;
      }
      if (!this.allowBid(buyer.id)) {
        ack({
          ok: false,
          code: 'rate_limited',
          message: 'Too many bid attempts. Wait briefly and try again.',
        });
        return;
      }
      const result = await this.auctions.placeBid(buyer, request);
      const state = {
        ...result.state,
        viewerCount: this.viewerCount(request.auctionId),
      };
      if (!result.duplicate) {
        this.namespace
          .to(this.room(request.auctionId))
          .emit('auction.bid.accepted', {
            bid: result.bid,
            state,
          });
        this.namespace
          .to(this.room(request.auctionId))
          .emit('auction.state', state);
      }
      ack({ ok: true, duplicate: result.duplicate, bid: result.bid, state });
    } catch (error) {
      ack(this.refusal(error));
    }
  }

  private async validatePayload<T extends object>(
    type: new () => T,
    input: unknown,
  ): Promise<T | null> {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return null;
    const instance = plainToInstance(type, input);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    return errors.length === 0 ? instance : null;
  }

  private acknowledger<T>(acknowledge: (result: T) => void) {
    return typeof acknowledge === 'function' ? acknowledge : () => undefined;
  }

  private allowBid(buyerId: string) {
    const now = Date.now();
    for (const [id, times] of this.bidWindows) {
      const live = times.filter((time) => now - time < 10_000);
      if (live.length === 0) this.bidWindows.delete(id);
      else this.bidWindows.set(id, live);
    }
    if (!this.bidWindows.has(buyerId) && this.bidWindows.size >= 10_000) {
      return false;
    }
    const window = (this.bidWindows.get(buyerId) ?? []).filter(
      (time) => now - time < 10_000,
    );
    if (window.length >= 10) {
      this.bidWindows.set(buyerId, window);
      return false;
    }
    window.push(now);
    this.bidWindows.set(buyerId, window);
    return true;
  }

  private async publishViewerCount(auctionId: string) {
    try {
      const state = await this.auctions.getLiveState(
        auctionId,
        this.viewerCount(auctionId),
      );
      this.namespace.to(this.room(auctionId)).emit('auction.state', state);
    } catch {
      // The room may close while a disconnect is being processed.
    }
  }

  private viewerCount(auctionId: string) {
    let count = 0;
    for (const socket of this.sockets.values()) {
      if (socket.joinedAuctions.has(auctionId)) count += 1;
    }
    return count;
  }

  private room(auctionId: string) {
    return `auction:${auctionId}`;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private refusal(error: unknown): AuctionBidAcknowledgement {
    if (error instanceof UnauthorizedException)
      return {
        ok: false,
        code: 'unauthorized',
        message: 'Sign in again to bid.',
      };
    if (error instanceof ForbiddenException)
      return { ok: false, code: 'forbidden', message: error.message };
    if (error instanceof BadRequestException)
      return { ok: false, code: 'invalid_input', message: error.message };
    if (error instanceof NotFoundException)
      return { ok: false, code: 'not_found', message: 'Auction not found.' };
    if (error instanceof ConflictException)
      return { ok: false, code: 'bid_rejected', message: error.message };
    if (
      error instanceof ServiceUnavailableException ||
      (this.isHttpException(error) && error.getStatus() >= 500)
    ) {
      return {
        ok: false,
        code: 'service_unavailable',
        message: 'Bidding is temporarily unavailable. Try again shortly.',
      };
    }
    return {
      ok: false,
      code: 'service_unavailable',
      message: 'Bidding is temporarily unavailable. Try again shortly.',
    };
  }

  private isHttpException(error: unknown): error is HttpException {
    return (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    );
  }
}
