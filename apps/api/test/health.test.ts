import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HealthService } from '../dist/health/health.service.js';
import { validateEnvironment } from '../dist/config.js';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import type { StorageService } from '../dist/storage/storage.service.js';
import type { RedisService } from '../dist/redis/redis.service.js';

const connected = {
  db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) },
} as unknown as Connection;
function storage(ping: () => Promise<void>) {
  return { ping } as StorageService;
}
function redis(ping: () => Promise<string>) {
  return { ping } as RedisService;
}

test('readiness requires MongoDB and storage', async () => {
  const service = new HealthService(
    connected,
    storage(async () => {}),
    redis(async () => 'PONG'),
  );
  assert.deepEqual(await service.readiness(), {
    status: 'ok',
    checks: { mongodb: 'up', storage: 'up', redis: 'up' },
  });
});

test('storage failure returns 503 without exposing credentials or internal errors', async () => {
  const service = new HealthService(
    connected,
    storage(async () => {
      throw new Error('private internal details');
    }),
    redis(async () => 'PONG'),
  );
  await assert.rejects(service.readiness(), (error) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.getStatus(), 503);
    assert.deepEqual(error.getResponse(), {
      status: 'degraded',
      checks: { mongodb: 'up', storage: 'down', redis: 'up' },
    });
    return true;
  });
});

test('disconnected MongoDB prevents readiness', async () => {
  const service = new HealthService(
    {} as Connection,
    storage(async () => {}),
    redis(async () => 'PONG'),
  );
  await assert.rejects(service.readiness(), (error) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(
      (error.getResponse() as { checks: { mongodb: string } }).checks.mongodb,
      'down',
    );
    return true;
  });
});

test('missing environment configuration fails early without printing values', () => {
  assert.throws(() => validateEnvironment({}), /Missing MONGODB_URI/);
});
