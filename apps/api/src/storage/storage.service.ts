import { createHash, createHmac } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const DEFAULT_SIGNED_GET_URL_EXPIRES_IN_SECONDS = 300;
export const MIN_SIGNED_GET_URL_EXPIRES_IN_SECONDS = 60;
export const MAX_SIGNED_GET_URL_EXPIRES_IN_SECONDS = 900;

export interface PutStorageObjectParams {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface SignedGetUrlResult {
  url: string;
  expiresInSeconds: number;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString();
  const dateStamp = iso.slice(0, 10).replace(/-/g, '');
  const timeStamp = iso.slice(11, 19).replace(/:/g, '');
  return {
    amzDate: `${dateStamp}T${timeStamp}Z`,
    dateStamp,
  };
}

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpointUrl: URL;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    // Signed URLs are opened by browsers, which may reach storage on a different
    // host than the API does (e.g. `storage:4566` inside Compose).
    this.endpointUrl = new URL(
      config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint,
    );
    this.region = config.getOrThrow<string>('S3_REGION');
    this.accessKeyId = config.getOrThrow<string>('S3_ACCESS_KEY_ID');
    this.secretAccessKey = config.getOrThrow<string>('S3_SECRET_ACCESS_KEY');

    this.client = new S3Client({
      endpoint,
      region: this.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      maxAttempts: 1,
      requestHandler: { requestTimeout: 3000, connectionTimeout: 3000 },
    });
  }

  async ping() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async putObject(params: PutStorageObjectParams): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ContentLength: params.body.byteLength,
        CacheControl: params.cacheControl ?? 'private, max-age=300',
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  createSignedGetUrl(
    key: string,
    expiresInSeconds = DEFAULT_SIGNED_GET_URL_EXPIRES_IN_SECONDS,
    now: Date = new Date(),
  ): SignedGetUrlResult {
    const boundedExpires = Math.min(
      MAX_SIGNED_GET_URL_EXPIRES_IN_SECONDS,
      Math.max(
        MIN_SIGNED_GET_URL_EXPIRES_IN_SECONDS,
        Math.trunc(expiresInSeconds),
      ),
    );
    const { amzDate, dateStamp } = formatAmzDate(now);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const basePath = this.endpointUrl.pathname.replace(/\/$/, '');
    const encodedKey = key
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeRfc3986(segment))
      .join('/');
    const canonicalUri = `${basePath}/${encodeRfc3986(this.bucket)}/${encodedKey}`;

    const queryEntries: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.accessKeyId}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(boundedExpires)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    queryEntries.sort(([a], [b]) => a.localeCompare(b));
    const canonicalQueryString = queryEntries
      .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
      .join('&');

    const canonicalHeaders = `host:${this.endpointUrl.host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const dateKey = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
    const regionKey = hmacSha256(dateKey, this.region);
    const serviceKey = hmacSha256(regionKey, 's3');
    const signingKey = hmacSha256(serviceKey, 'aws4_request');
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const url = `${this.endpointUrl.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    return {
      url,
      expiresInSeconds: boundedExpires,
    };
  }

  onModuleDestroy() {
    this.client.destroy();
  }
}
