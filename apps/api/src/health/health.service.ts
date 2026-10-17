import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly storage: StorageService,
  ) {}

  async readiness() {
    const results = await Promise.allSettled([
      this.pingDatabase(),
      this.storage.ping(),
    ]);
    const checks = {
      mongodb: results[0].status === 'fulfilled' ? 'up' : 'down',
      storage: results[1].status === 'fulfilled' ? 'up' : 'down',
    };
    if (results.some((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }
    return { status: 'ok', checks };
  }

  private async pingDatabase() {
    if (!this.connection.db) throw new Error('Database is not connected');
    await this.connection.db.admin().ping({ timeoutMS: 3000 });
  }
}
