import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { bucket, createS3Client } from './s3-client.ts';

const base = `http://127.0.0.1:${process.env.API_PORT ?? 3000}`;
const mongoUrl = process.env.MONGODB_URI;
const redisUrl = process.env.REDIS_URL;
assert.ok(typeof mongoUrl === 'string', 'MONGODB_URI must be configured');
assert.ok(typeof redisUrl === 'string', 'REDIS_URL must be configured');
for (const path of [
  '/api/health/live',
  '/api/health/ready',
  '/api-docs-json',
]) {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200, `${path} must return 200`);
  const body = (await response.json()) as {
    status?: string;
    paths: Record<string, unknown>;
  };
  if (path.includes('health')) assert.equal(body.status, 'ok');
  else assert.ok(body.paths['/api/health/ready']);
}
console.log('API health, readiness, and OpenAPI passed.');

const connection = await mongoose
  .createConnection(mongoUrl, {
    serverSelectionTimeoutMS: 5000,
  })
  .asPromise();
const key = `smoke/${randomUUID()}.txt`;
const collection = connection.db!.collection<{ _id: string; message: string }>(
  '_setup_smoke',
);
const client = createS3Client();
const redis = createClient({
  url: redisUrl,
  disableOfflineQueue: true,
  socket: { connectTimeout: 3000, reconnectStrategy: false },
});
redis.on('error', () => undefined);
const redisKey = `dwc:smoke:${randomUUID()}`;
async function runRedisCommand<T>(operation: () => Promise<T>) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          if (redis.isOpen) redis.destroy();
          reject(new Error('Redis smoke command timed out'));
        }, 1500);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
try {
  await runRedisCommand(() => redis.connect());
  await collection.insertOne({ _id: key, message: 'dwc-smoke' });
  assert.equal((await collection.findOne({ _id: key }))?.message, 'dwc-smoke');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: 'dwc-smoke',
      ContentType: 'text/plain',
    }),
  );
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  assert.equal(await object.Body?.transformToString(), 'dwc-smoke');
  await runRedisCommand(() =>
    redis
      .withCommandOptions({ timeout: 1500 })
      .set(redisKey, 'dwc-smoke', { EX: 2 }),
  );
  assert.equal(await runRedisCommand(() => redis.get(redisKey)), 'dwc-smoke');
  await new Promise((resolve) => setTimeout(resolve, 2200));
  assert.equal(await runRedisCommand(() => redis.get(redisKey)), null);
  console.log('MongoDB, S3, and Redis round-trip/expiry passed.');
} finally {
  try {
    if (redis.isReady) {
      await runRedisCommand(() => redis.del(redisKey));
    }
  } finally {
    if (redis.isOpen) redis.destroy();
    try {
      await Promise.all([
        collection.deleteOne({ _id: key }),
        client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
      ]);
    } finally {
      client.destroy();
      await connection.close();
    }
  }
}
