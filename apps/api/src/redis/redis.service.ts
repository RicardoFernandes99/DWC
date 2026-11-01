import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { SetOptions } from 'redis';

const COMMAND_TIMEOUT_MS = 1500;
const CONNECTION_TIMEOUT_MS = 3000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: ReturnType<typeof createClient>;
  private shuttingDown = false;
  private readonly activeOperations = new Set<Promise<unknown>>();
  private readonly connectionTimeouts = new Map<
    ReturnType<typeof createClient>,
    NodeJS.Timeout
  >();
  private readonly url: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('REDIS_URL');
    this.client = this.createClient();
  }

  get isReady() {
    return this.client.isReady;
  }

  onModuleInit() {
    this.connect(this.client);
  }

  async ping() {
    if (!this.client.isReady) throw new Error('Redis is not connected');
    return this.execute((client) => client.ping());
  }

  async get(key: string) {
    return this.execute((client) => client.get(key));
  }

  async set(key: string, value: string, options?: SetOptions) {
    return this.execute((client) => client.set(key, value, options));
  }

  async del(key: string) {
    return this.execute((client) => client.del(key));
  }

  execute<T>(
    operation: (client: ReturnType<typeof createClient>) => Promise<T>,
  ) {
    if (this.shuttingDown) {
      return Promise.reject(new Error('Redis client is shutting down'));
    }
    if (!this.client.isReady) {
      return Promise.reject(new Error('Redis is not connected'));
    }

    const activeClient = this.client;
    let timeout: NodeJS.Timeout | undefined;
    const command = Promise.resolve().then(() =>
      operation(
        activeClient.withCommandOptions({ timeout: COMMAND_TIMEOUT_MS }),
      ),
    );
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        this.resetClient(activeClient);
        reject(new Error('Redis operation timed out'));
      }, COMMAND_TIMEOUT_MS);
    });
    const activeOperation = Promise.race([command, deadline]);
    this.activeOperations.add(activeOperation);

    return activeOperation.finally(() => {
      if (timeout) clearTimeout(timeout);
      this.activeOperations.delete(activeOperation);
    });
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    for (const timeout of this.connectionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.connectionTimeouts.clear();
    if (this.activeOperations.size > 0) {
      await Promise.allSettled([...this.activeOperations]);
    }
    if (this.client.isOpen) this.client.destroy();
  }

  private createClient() {
    const client = createClient({
      url: this.url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: CONNECTION_TIMEOUT_MS,
        reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 2000),
      },
    });
    client.on('error', () => undefined);
    client.on('ready', () => {
      this.clearConnectionTimeout(client);
    });
    client.on('reconnecting', () => {
      this.startConnectionTimeout(client);
    });
    return client;
  }

  private connect(client: ReturnType<typeof createClient>) {
    this.startConnectionTimeout(client);
    void client.connect().catch(() => undefined);
  }

  private resetClient(client: ReturnType<typeof createClient>) {
    if (client !== this.client) return;
    this.clearConnectionTimeout(client);
    if (client.isOpen) client.destroy();
    if (this.shuttingDown) return;
    this.client = this.createClient();
    this.connect(this.client);
  }

  private startConnectionTimeout(client: ReturnType<typeof createClient>) {
    this.clearConnectionTimeout(client);
    const timeout = setTimeout(() => {
      this.connectionTimeouts.delete(client);
      this.resetClient(client);
    }, CONNECTION_TIMEOUT_MS + 1000);
    this.connectionTimeouts.set(client, timeout);
  }

  private clearConnectionTimeout(client: ReturnType<typeof createClient>) {
    const timeout = this.connectionTimeouts.get(client);
    if (timeout) clearTimeout(timeout);
    this.connectionTimeouts.delete(client);
  }
}
