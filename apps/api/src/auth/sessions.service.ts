import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service.js';

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
interface Session {
  userId: string;
  hash: string;
  expiresAt: number;
}
const rotateScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local session = cjson.decode(raw)
if session.hash ~= ARGV[1] then return false end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if session.expiresAt <= now then redis.call('DEL', KEYS[1]); return false end
session.hash = ARGV[2]
local ttl = math.min(redis.call('PTTL', KEYS[1]), session.expiresAt - now)
if ttl <= 0 then return false end
redis.call('SET', KEYS[1], cjson.encode(session), 'PX', ttl)
return cjson.encode(session)`;
const revokeScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).hash ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])`;

@Injectable()
export class SessionsService {
  constructor(private readonly redis: RedisService) {}

  private hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }
  private key(id: string) {
    return `auth:session:${id}`;
  }
  private parse(token: string | undefined) {
    if (!token || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(token))
      return null;
    const [id, secret] = token.split('.');
    if (!id || !secret) return null;
    return { id, hash: this.hash(secret) };
  }

  private decode(raw: string): Session {
    try {
      const value: unknown = JSON.parse(raw);
      if (
        typeof value === 'object' &&
        value !== null &&
        'userId' in value &&
        typeof value.userId === 'string' &&
        /^[0-9a-f]{24}$/.test(value.userId) &&
        'hash' in value &&
        typeof value.hash === 'string' &&
        /^[0-9a-f]{64}$/.test(value.hash) &&
        'expiresAt' in value &&
        typeof value.expiresAt === 'number' &&
        Number.isSafeInteger(value.expiresAt)
      ) {
        return {
          userId: value.userId,
          hash: value.hash,
          expiresAt: value.expiresAt,
        };
      }
    } catch {
      /* Invalid persisted records fail closed. */
    }
    throw new ServiceUnavailableException(
      'Authentication service unavailable.',
    );
  }

  private async available<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service unavailable.',
      );
    }
  }

  async create(userId: string) {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const session: Session = {
      userId,
      hash: this.hash(secret),
      expiresAt: Date.now() + SESSION_SECONDS * 1000,
    };
    await this.available(() =>
      this.redis.set(this.key(id), JSON.stringify(session), {
        PXAT: session.expiresAt,
      }),
    );
    return { id, token: `${id}.${secret}`, ...session };
  }

  async rotate(token: string | undefined) {
    const credential = this.parse(token);
    if (!credential) throw new UnauthorizedException();
    const secret = randomBytes(32).toString('base64url');
    const raw = await this.available(() =>
      this.redis.execute((client) =>
        client.eval(rotateScript, {
          keys: [this.key(credential.id)],
          arguments: [credential.hash, this.hash(secret)],
        }),
      ),
    );
    if (typeof raw !== 'string') throw new UnauthorizedException();
    const session = this.decode(raw);
    return {
      ...session,
      id: credential.id,
      token: `${credential.id}.${secret}`,
    };
  }

  async revoke(token: string | undefined) {
    const credential = this.parse(token);
    if (!credential) return;
    await this.available(() =>
      this.redis.execute((client) =>
        client.eval(revokeScript, {
          keys: [this.key(credential.id)],
          arguments: [credential.hash],
        }),
      ),
    );
  }

  async require(id: string, userId: string) {
    const raw = await this.available(() => this.redis.get(this.key(id)));
    if (!raw) throw new UnauthorizedException();
    const session = this.decode(raw);
    if (session.userId !== userId || session.expiresAt <= Date.now())
      throw new UnauthorizedException();
  }
}
