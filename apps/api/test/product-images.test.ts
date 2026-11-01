import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { StorageService } from '../dist/storage/storage.service.js';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGE_DIMENSION,
  validateProductImage,
} from '../dist/products/product-image.validator.js';
import { ProductsService } from '../dist/products/products.service.js';
import { ProducerStatus, UserRole } from '../dist/users/user.schema.js';

function createValidPng(width = 64, height = 48): Buffer {
  const buf = Buffer.alloc(33);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 6;
  return buf;
}

function createValidJpeg(width = 80, height = 60): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf.writeUInt16BE(4, 4);
  buf[8] = 0xff;
  buf[9] = 0xc0;
  buf.writeUInt16BE(11, 10);
  buf[12] = 8;
  buf.writeUInt16BE(height, 13);
  buf.writeUInt16BE(width, 15);
  buf[17] = 3;
  buf[21] = 0xff;
  buf[22] = 0xd9;
  return buf;
}

function createValidWebp(width = 32, height = 24): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(22, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  buf.writeUInt16LE(width, 26);
  buf.writeUInt16LE(height, 28);
  return buf;
}

test('validateProductImage accepts valid PNG, JPEG and WebP buffers', () => {
  const png = validateProductImage({
    buffer: createValidPng(120, 90),
    mimetype: 'image/png',
  });
  assert.deepEqual(png, {
    mimeType: 'image/png',
    extension: 'png',
    sizeBytes: 33,
    width: 120,
    height: 90,
  });

  const jpeg = validateProductImage({
    buffer: createValidJpeg(240, 180),
    mimetype: 'image/jpeg',
  });
  assert.deepEqual(jpeg, {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    sizeBytes: 24,
    width: 240,
    height: 180,
  });

  const webp = validateProductImage({
    buffer: createValidWebp(64, 64),
    mimetype: 'image/webp',
  });
  assert.deepEqual(webp, {
    mimeType: 'image/webp',
    extension: 'webp',
    sizeBytes: 30,
    width: 64,
    height: 64,
  });
});

test('validateProductImage rejects SVG, spoofed MIME types, oversized files and invalid pixel bounds', () => {
  assert.throws(
    () =>
      validateProductImage({
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
        ),
        mimetype: 'image/svg+xml',
      }),
    (err: unknown) =>
      err instanceof BadRequestException &&
      /SVG images are not allowed/.test(err.message),
  );

  assert.throws(
    () =>
      validateProductImage({
        buffer: Buffer.from(
          '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ),
        mimetype: 'image/png',
      }),
    (err: unknown) =>
      err instanceof BadRequestException &&
      /SVG images are not allowed/.test(err.message),
  );

  assert.throws(
    () =>
      validateProductImage({
        buffer: createValidPng(64, 64),
        mimetype: 'image/jpeg',
      }),
    (err: unknown) =>
      err instanceof BadRequestException &&
      /MIME type does not match/.test(err.message),
  );

  assert.throws(
    () =>
      validateProductImage({
        buffer: Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1, 0x00),
        mimetype: 'image/png',
      }),
    (err: unknown) =>
      err instanceof BadRequestException && /must not exceed/.test(err.message),
  );

  assert.throws(
    () =>
      validateProductImage({
        buffer: createValidPng(MAX_PRODUCT_IMAGE_DIMENSION + 1, 64),
        mimetype: 'image/png',
      }),
    (err: unknown) =>
      err instanceof BadRequestException &&
      /dimensions must be/.test(err.message),
  );
});

test('StorageService.createSignedGetUrl produces bounded SigV4 URL without leaking secret key', () => {
  const secretKey = 'super-secret-s3-key-never-leak';
  const configValues: Record<string, string> = {
    S3_BUCKET: 'product-images',
    S3_ENDPOINT: 'http://127.0.0.1:4566',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'dwc-local-access',
    S3_SECRET_ACCESS_KEY: secretKey,
  };
  const config = {
    getOrThrow: (key: string) => configValues[key],
  } as unknown as ConfigService;

  const storage = new StorageService(config);
  try {
    const signed = storage.createSignedGetUrl(
      'products/u1/p1/sample.png',
      300,
      new Date('2026-11-01T12:00:00.000Z'),
    );
    assert.equal(signed.expiresInSeconds, 300);
    assert.ok(
      signed.url.startsWith(
        'http://127.0.0.1:4566/product-images/products/u1/p1/sample.png?',
      ),
    );
    assert.ok(signed.url.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
    assert.ok(signed.url.includes('X-Amz-Expires=300'));
    assert.ok(signed.url.includes('X-Amz-Signature='));
    assert.equal(signed.url.includes(secretKey), false);
  } finally {
    storage.onModuleDestroy();
  }
});

test('ProductsService refuses image URL minting for archived, moderated or ineligible products', async () => {
  const producerId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  let archivedAt: Date | null = null;
  let moderatedAt: Date | null = null;
  const published = true;
  let producerStatus = ProducerStatus.Approved;

  const fakeProductsModel = {
    findOne: async (filter: Record<string, unknown>) => {
      if (filter.published === true && !published) return null;
      if (filter.archivedAt === null && archivedAt !== null) return null;
      if (filter.moderatedAt === null && moderatedAt !== null) return null;
      return {
        _id: productId,
        producerId,
        name: 'Organic Apples',
        description: 'Crisp orchard apples',
        category: 'fruits',
        productionMethod: 'organic',
        seasons: ['autumn'],
        priceCents: 350,
        unit: 'kg',
        availableStock: 10,
        reservedStock: 0,
        lowStockThreshold: 2,
        published,
        archivedAt,
        moderatedAt,
        moderationReason: moderatedAt ? 'Policy review' : null,
        image: {
          objectKey: `products/${producerId.toString()}/${productId.toString()}/img.png`,
          mimeType: 'image/png',
          sizeBytes: 33,
          width: 64,
          height: 48,
          uploadedAt: new Date('2026-11-01T12:00:00.000Z'),
        },
        revision: 2,
        createdAt: new Date('2026-11-01T12:00:00.000Z'),
        updatedAt: new Date('2026-11-01T12:00:00.000Z'),
      };
    },
  };

  const fakeUsersModel = {
    exists: async (filter: Record<string, unknown>) => {
      if (
        filter.role === UserRole.Producer &&
        filter.producerStatus === ProducerStatus.Approved
      ) {
        return producerStatus === ProducerStatus.Approved
          ? { _id: producerId }
          : null;
      }
      return null;
    },
  };

  const fakeStorage = {
    createSignedGetUrl: (key: string) => ({
      url: `http://127.0.0.1:4566/product-images/${key}?X-Amz-Signature=test`,
      expiresInSeconds: 300,
    }),
  } as unknown as StorageService;

  const service = new ProductsService(
    fakeProductsModel as never,
    fakeUsersModel as never,
    fakeStorage,
  );

  // Eligible active product mints both owner preview and public signed URL
  const activePreview = await service.getImagePreviewForProducer(
    producerId.toString(),
    productId.toString(),
  );
  assert.ok(activePreview.url.includes('X-Amz-Signature=test'));
  const activePublic = await service.resolvePublicImageUrl(
    productId.toString(),
  );
  assert.ok(activePublic?.url.includes('X-Amz-Signature=test'));

  // Archived product refuses fresh owner preview URL and public URL while preserving metadata
  archivedAt = new Date('2026-11-01T13:00:00.000Z');
  const archivedDetail = await service.getForProducer(
    producerId.toString(),
    productId.toString(),
  );
  assert.equal(archivedDetail.hasImage, true);
  assert.equal(archivedDetail.imageUrl, null);
  assert.ok(archivedDetail.imageMeta !== null);
  await assert.rejects(
    service.getImagePreviewForProducer(
      producerId.toString(),
      productId.toString(),
    ),
    (err: unknown) => err instanceof ConflictException,
  );
  assert.equal(await service.resolvePublicImageUrl(productId.toString()), null);

  // Moderated product refuses fresh owner preview URL and public URL
  archivedAt = null;
  moderatedAt = new Date('2026-11-01T14:00:00.000Z');
  const moderatedDetail = await service.getForProducer(
    producerId.toString(),
    productId.toString(),
  );
  assert.equal(moderatedDetail.hasImage, true);
  assert.equal(moderatedDetail.imageUrl, null);
  await assert.rejects(
    service.getImagePreviewForProducer(
      producerId.toString(),
      productId.toString(),
    ),
    (err: unknown) => err instanceof ConflictException,
  );
  assert.equal(await service.resolvePublicImageUrl(productId.toString()), null);

  // Suspended producer cannot mint public URL or access producer preview
  moderatedAt = null;
  producerStatus = ProducerStatus.Suspended;
  assert.equal(await service.resolvePublicImageUrl(productId.toString()), null);
  await assert.rejects(
    service.getImagePreviewForProducer(
      producerId.toString(),
      productId.toString(),
    ),
    (err: unknown) => err instanceof ForbiddenException,
  );
});
