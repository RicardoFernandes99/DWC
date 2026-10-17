import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { bucket, createS3Client } from './s3-client.ts';

const base = `http://127.0.0.1:${process.env.API_PORT ?? 3000}`;
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
  .createConnection(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 5000,
  })
  .asPromise();
const key = `smoke/${randomUUID()}.txt`;
const collection = connection.db!.collection<{ _id: string; message: string }>(
  '_setup_smoke',
);
const client = createS3Client();
try {
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
  console.log('MongoDB write/read and S3 upload/download passed.');
} finally {
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
