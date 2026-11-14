import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { ServerOptions } from 'socket.io';

type RedisClient = ReturnType<typeof createClient>;

/**
 * Socket.io with a Redis pub/sub adapter, so room broadcasts (live bids,
 * personal notifications) reach clients connected to any API replica.
 */
export class SocketIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(SocketIoAdapter.name);
  private readonly webOrigin: string;
  private readonly redisUrl: string;
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly clients: RedisClient[] = [];

  constructor(app: INestApplication, config: ConfigService) {
    super(app);
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN');
    this.redisUrl = config.getOrThrow<string>('REDIS_URL');
  }

  /** Connects the pub/sub clients before the gateways create their servers. */
  async connectToRedis(): Promise<void> {
    const publisher = createClient({ url: this.redisUrl });
    const subscriber = publisher.duplicate();
    for (const client of [publisher, subscriber]) {
      client.on('error', (error: unknown) => {
        const detail = error instanceof Error ? error.message : 'unknown';
        this.redisLogger.warn(`Socket.io Redis adapter error: ${detail}`);
      });
      this.clients.push(client);
    }
    await Promise.all([publisher.connect(), subscriber.connect()]);
    this.adapterConstructor = createAdapter(publisher, subscriber);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const serverOptions = options ?? ({} as ServerOptions);
    serverOptions.cors = {
      ...serverOptions.cors,
      origin: this.webOrigin,
      credentials: true,
    };
    const server = super.createIOServer(port, serverOptions);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  override async close(server: Parameters<IoAdapter['close']>[0]) {
    await super.close(server);
    await Promise.all(
      this.clients
        .splice(0)
        .map((client) =>
          client.isOpen ? client.quit().catch(() => undefined) : undefined,
        ),
    );
  }
}
