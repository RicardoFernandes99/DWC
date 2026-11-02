import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from 'redis';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { ValidationPipe } from '@nestjs/common';
import { SignJWT } from 'jose';
import { io, type Socket } from 'socket.io-client';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import type { components } from '../../web/src/lib/api-schema.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../src/realtime/realtime.events.js';

type ReviewSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type ApiUserResponse = components['schemas']['UserResponseDto'];
type ApiAuthResponse = components['schemas']['AuthResponseDto'];
interface SignedInAccount {
  user: ApiUserResponse;
  accessToken: string;
  refreshCookie: string;
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  assert.ok(value, `${name} must be configured for this review`);
  return value;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  assert.ok(response.ok, `HTTP request failed with status ${response.status}`);
  return (await response.json()) as T;
}

async function rejectedConnection(
  url: string,
  auth: Record<string, unknown>,
  origin: string,
  label: string,
  transports?: Array<'polling' | 'websocket' | 'webtransport'>,
) {
  const socket = io(url, {
    autoConnect: false,
    auth,
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 3000,
    transports,
  });
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('connect_error timeout')),
      4000,
    );
    socket.once('connect', () => {
      clearTimeout(timeout);
      reject(new Error(`invalid socket unexpectedly connected: ${label}`));
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      const data: unknown = 'data' in error ? error.data : undefined;
      resolve(
        typeof data === 'object' &&
          data !== null &&
          'code' in data &&
          typeof data.code === 'string'
          ? data.code
          : 'missing_code',
      );
    });
    socket.connect();
  });
  socket.disconnect();
  return code;
}

async function connected(url: string, accessToken: string, origin: string) {
  const socket = io(url, {
    autoConnect: false,
    auth: { accessToken },
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 3000,
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('connect timeout')),
      4000,
    );
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.connect();
  });
  return socket;
}

async function arbitraryRoomClient(
  url: string,
  accessToken: string,
  origin: string,
) {
  const socket = io(url, {
    autoConnect: false,
    auth: {
      accessToken,
      userId: 'attacker-controlled',
      room: 'user:attacker-controlled',
    },
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 3000,
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('connect timeout')),
      4000,
    );
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.connect();
  });
  return socket;
}

function waitForEvent(socket: ReviewSocket, timeoutMs = 1500) {
  return new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs);
    socket.once('notification.created', ({ notificationId }) => {
      clearTimeout(timeout);
      resolve(notificationId);
    });
  });
}

async function registerAndLogin(
  baseUrl: string,
  origin: string,
  suffix: string,
  role: 'buyer' | 'producer',
  users: string[],
): Promise<SignedInAccount> {
  const email = `ticket022-${suffix}-${randomUUID()}@example.test`;
  const password = `Ticket022-${randomUUID()}!`;
  const user = await request<ApiUserResponse>(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Ticket 022 ${suffix}`,
      email,
      password,
      role,
    }),
  });
  users.push(user.id);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, 'login should remain available');
  const body = (await response.json()) as ApiAuthResponse;
  const setCookie = response.headers.get('set-cookie');
  assert.ok(
    setCookie?.startsWith('dwc_refresh='),
    'login should set refresh cookie',
  );
  const refreshCookie = setCookie?.split(';', 1)[0];
  assert.ok(refreshCookie, 'login should return a refresh cookie');
  return {
    user: body.user,
    accessToken: body.accessToken,
    refreshCookie,
  };
}

async function logout(
  baseUrl: string,
  origin: string,
  account: SignedInAccount,
) {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: account.refreshCookie },
  });
  assert.equal(response.status, 204, 'logout should revoke the session');
}

async function clearReviewSessions(
  redisUrl: string,
  accounts: SignedInAccount[],
) {
  if (accounts.length === 0) return;
  const client = createClient({ url: redisUrl, disableOfflineQueue: true });
  client.on('error', () => undefined);
  await client.connect();
  try {
    const keys = accounts.flatMap((account) => {
      const id = account.refreshCookie.match(
        /^dwc_refresh=([0-9a-f-]{36})\./,
      )?.[1];
      return id ? [`auth:session:${id}`] : [];
    });
    if (keys.length > 0) await client.del(keys);
  } finally {
    await client.quit();
  }
}

async function main() {
  process.loadEnvFile('.env');
  const originalRedisUrl = requireEnvironment('REDIS_URL');
  const mongoUri = new URL(requireEnvironment('MONGODB_URI'));
  mongoUri.pathname = `/dwc_ticket022_${randomUUID().replaceAll('-', '')}`;
  process.env.MONGODB_URI = mongoUri.toString();
  const origin = requireEnvironment('WEB_ORIGIN');
  const port = 0;
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  let shutdownSocket: ReviewSocket | undefined;
  const accounts: SignedInAccount[] = [];
  const users: string[] = [];

  try {
    const [
      { AppModule },
      { SocketIoAdapter },
      { PersonalEventPublisher },
      { RedisService },
    ] = await Promise.all([
      import('../dist/app.module.js'),
      import('../dist/realtime/socket-io.adapter.js'),
      import('../dist/realtime/personal-event.publisher.js'),
      import('../dist/redis/redis.service.js'),
    ]);
    app = await NestFactory.create(AppModule, { logger: false });
    const config = app.get(ConfigService);
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: config.getOrThrow<string>('WEB_ORIGIN'),
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useWebSocketAdapter(new SocketIoAdapter(app, config));
    await app.listen(port, '127.0.0.1');
    const actualPort = (app.getHttpServer().address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${actualPort}`;

    const health = await fetch(`${baseUrl}/api/health/live`);
    assert.equal(
      health.status,
      200,
      'existing HTTP health route should remain available',
    );

    const polling = await fetch(
      `${baseUrl}/socket.io/?EIO=4&transport=polling`,
      {
        headers: { Origin: origin },
      },
    );
    assert.equal(polling.headers.get('access-control-allow-origin'), origin);
    assert.equal(
      polling.headers.get('access-control-allow-credentials'),
      'true',
    );
    const wrongOrigin = await fetch(
      `${baseUrl}/socket.io/?EIO=4&transport=polling`,
      {
        headers: { Origin: 'https://invalid.example' },
      },
    );
    assert.notEqual(
      wrongOrigin.headers.get('access-control-allow-origin'),
      'https://invalid.example',
    );

    const buyerA = await registerAndLogin(
      baseUrl,
      origin,
      'buyer-a',
      'buyer',
      users,
    );
    const buyerB = await registerAndLogin(
      baseUrl,
      origin,
      'buyer-b',
      'buyer',
      users,
    );
    const producer = await registerAndLogin(
      baseUrl,
      origin,
      'producer',
      'producer',
      users,
    );
    accounts.push(buyerA, buyerB, producer);

    const buyerASocket = await connected(baseUrl, buyerA.accessToken, origin);
    const buyerBSocket = await connected(baseUrl, buyerB.accessToken, origin);
    const producerSocket = await connected(
      baseUrl,
      producer.accessToken,
      origin,
    );
    shutdownSocket = producerSocket;
    const attackerSocket = await arbitraryRoomClient(
      baseUrl,
      buyerA.accessToken,
      origin,
    );

    assert.equal(
      await rejectedConnection(baseUrl, {}, origin, 'missing token'),
      'unauthorized',
    );
    const [header, claims, signature] = buyerA.accessToken.split('.');
    assert.ok(header && claims && signature);
    const alteredSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    assert.equal(
      await rejectedConnection(
        baseUrl,
        { accessToken: `${header}.${claims}.${alteredSignature}` },
        origin,
        'altered token',
      ),
      'unauthorized',
    );
    const expiredToken = await new SignJWT({ sid: randomUUID() })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(buyerA.user.id)
      .setIssuer(requireEnvironment('JWT_ISSUER'))
      .setAudience(requireEnvironment('JWT_AUDIENCE'))
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(requireEnvironment('JWT_SECRET')));
    assert.equal(
      await rejectedConnection(
        baseUrl,
        { accessToken: expiredToken },
        origin,
        'expired token',
      ),
      'unauthorized',
    );
    assert.equal(
      await rejectedConnection(
        baseUrl,
        { accessToken: buyerA.accessToken },
        'https://invalid.example',
        'wrong origin',
        ['websocket'],
      ),
      'origin_not_allowed',
    );

    const publisher = app.get(PersonalEventPublisher);
    const notificationIdA = randomUUID().replaceAll('-', '').slice(0, 24);
    const aEvent = waitForEvent(buyerASocket);
    const bNoLeak = waitForEvent(buyerBSocket, 350);
    const producerNoLeak = waitForEvent(producerSocket, 350);
    await publisher.publishNotificationCreated(buyerA.user.id, notificationIdA);
    assert.equal(
      await aEvent,
      notificationIdA,
      'the owner should receive the private event',
    );
    assert.equal(
      await bNoLeak,
      null,
      'another account must not receive the event',
    );
    assert.equal(
      await producerNoLeak,
      null,
      'producer account must not receive another user event',
    );

    // A client can send arbitrary application event names and room IDs; no join
    // handler exists, so this cannot alter the server-derived room membership.
    attackerSocket.emit('joinRoom', `user:${buyerB.user.id}`);
    const notificationIdB = randomUUID().replaceAll('-', '').slice(0, 24);
    const bEvent = waitForEvent(buyerBSocket);
    const aNoLeak = waitForEvent(buyerASocket, 350);
    let attackerReceived = false;
    attackerSocket.once('notification.created', () => {
      attackerReceived = true;
    });
    await publisher.publishNotificationCreated(buyerB.user.id, notificationIdB);
    assert.equal(await bEvent, notificationIdB);
    assert.equal(
      await aNoLeak,
      null,
      'attempted arbitrary room join must not cross accounts',
    );
    await delay(350);
    assert.equal(
      attackerReceived,
      false,
      'a client supplied user ID and room must not grant access',
    );

    await logout(baseUrl, origin, buyerA);
    const revokedNoLeak = waitForEvent(buyerASocket, 350);
    const revokedDisconnect = new Promise<void>((resolve) =>
      buyerASocket.once('disconnect', () => resolve()),
    );
    await publisher.publishNotificationCreated(
      buyerA.user.id,
      randomUUID().replaceAll('-', '').slice(0, 24),
    );
    assert.equal(
      await revokedNoLeak,
      null,
      'revoked sessions must receive no subsequent event',
    );
    await revokedDisconnect;

    const redis = app.get(RedisService);
    await redis.onModuleDestroy();
    const redisFailureNoLeak = waitForEvent(buyerBSocket, 350);
    const redisFailureDisconnect = new Promise<void>((resolve) =>
      buyerBSocket.once('disconnect', () => resolve()),
    );
    await publisher.publishNotificationCreated(
      buyerB.user.id,
      randomUUID().replaceAll('-', '').slice(0, 24),
    );
    assert.equal(
      await redisFailureNoLeak,
      null,
      'Redis failure must prevent later private delivery',
    );
    await redisFailureDisconnect;

    console.log(
      'ticket 022 socket review passed: buyers/producers, JWT refusals, room isolation, revocation, Origin CORS, Redis failure.',
    );
  } finally {
    if (app) {
      const socketForShutdown = shutdownSocket;
      try {
        const database = app.get<Connection>(getConnectionToken());
        if (users.length > 0) {
          await database.collection('users').deleteMany({
            _id: { $in: users.map((userId) => new Types.ObjectId(userId)) },
          });
        }
        await clearReviewSessions(originalRedisUrl, accounts);
      } finally {
        const shutdownDisconnect = socketForShutdown?.connected
          ? new Promise<void>((resolve) =>
              socketForShutdown.once('disconnect', () => resolve()),
            )
          : Promise.resolve();
        await Promise.race([
          app.close(),
          delay(5000).then(() => {
            throw new Error('API shutdown did not complete promptly');
          }),
        ]);
        await Promise.race([
          shutdownDisconnect,
          delay(1000).then(() => {
            if (socketForShutdown?.connected) {
              throw new Error(
                'active socket did not disconnect during shutdown',
              );
            }
          }),
        ]);
      }
    }
    await delay(50);
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Ticket 022 socket review failed.',
  );
  process.exitCode = 1;
});
