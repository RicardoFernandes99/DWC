import { BadRequestException } from '@nestjs/common';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_PRODUCT_IMAGE_DIMENSION = 1;
export const MAX_PRODUCT_IMAGE_DIMENSION = 4096;
export const MAX_PRODUCT_IMAGE_PIXELS = 16_777_216;

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedProductImageMimeType =
  (typeof ALLOWED_PRODUCT_IMAGE_MIME_TYPES)[number];

export interface ValidatedProductImage {
  mimeType: AllowedProductImageMimeType;
  extension: 'jpg' | 'png' | 'webp';
  sizeBytes: number;
  width: number;
  height: number;
}

export interface UploadedImageFileInput {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const JPEG_SOF_MARKERS = new Set<number>([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function normalizeDeclaredMimeType(mimetype: string | undefined): string {
  if (!mimetype) {
    return '';
  }
  return mimetype.split(';')[0]?.trim().toLowerCase() ?? '';
}

function hasRasterSignature(buffer: Buffer): boolean {
  return (
    (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) ||
    (buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP')
  );
}

function looksLikeSvgContent(
  buffer: Buffer,
  declaredMimeType: string,
): boolean {
  if (declaredMimeType.includes('svg')) {
    return true;
  }
  // Raster files can carry "<svg" text in embedded metadata (XMP); a file
  // with a PNG, JPEG or WebP signature is decoded as raster, never as SVG.
  if (hasRasterSignature(buffer)) {
    return false;
  }
  const head = buffer
    .subarray(0, Math.min(buffer.length, 512))
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith('<svg') ||
    (head.startsWith('<?xml') && head.includes('<svg')) ||
    (head.startsWith('<!doctype svg') && head.includes('<svg')) ||
    head.includes('<svg ') ||
    head.includes('<svg>')
  );
}

function parsePngDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (
    buffer.length < 33 ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    buffer.readUInt32BE(8) !== 13 ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[2] !== 0xff
  ) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      return null;
    }

    const marker = buffer[offset]!;
    offset += 1;

    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (offset + 2 > buffer.length) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (
    buffer.length < 21 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  const chunkSize = buffer.readUInt32LE(16);
  if (20 + chunkSize > buffer.length) {
    return null;
  }

  if (chunkType === 'VP8 ') {
    if (
      chunkSize < 10 ||
      buffer.length < 30 ||
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      return null;
    }
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  if (chunkType === 'VP8L') {
    if (chunkSize < 5 || buffer.length < 25 || buffer[20] !== 0x2f) {
      return null;
    }
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (chunkType === 'VP8X') {
    if (chunkSize < 10 || buffer.length < 30) {
      return null;
    }
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { width, height };
  }

  return null;
}

export function validateProductImage(
  file: UploadedImageFileInput | undefined,
  subject = 'product image',
): ValidatedProductImage {
  const Subject = subject[0]!.toUpperCase() + subject.slice(1);
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.byteLength === 0) {
    throw new BadRequestException(`A non-empty ${subject} file is required.`);
  }

  const buffer = file.buffer;
  const sizeBytes = buffer.byteLength;
  if (sizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
    throw new BadRequestException(
      `${Subject} must not exceed ${MAX_PRODUCT_IMAGE_BYTES} bytes (5 MB).`,
    );
  }

  const declaredMimeType = normalizeDeclaredMimeType(file.mimetype);
  if (looksLikeSvgContent(buffer, declaredMimeType)) {
    throw new BadRequestException(
      'SVG images are not allowed. Upload a JPEG, PNG or WebP raster image.',
    );
  }

  let detected: {
    mimeType: AllowedProductImageMimeType;
    extension: 'jpg' | 'png' | 'webp';
    width: number;
    height: number;
  } | null = null;

  const png = parsePngDimensions(buffer);
  if (png) {
    detected = {
      mimeType: 'image/png',
      extension: 'png',
      width: png.width,
      height: png.height,
    };
  } else {
    const jpeg = parseJpegDimensions(buffer);
    if (jpeg) {
      detected = {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        width: jpeg.width,
        height: jpeg.height,
      };
    } else {
      const webp = parseWebpDimensions(buffer);
      if (webp) {
        detected = {
          mimeType: 'image/webp',
          extension: 'webp',
          width: webp.width,
          height: webp.height,
        };
      }
    }
  }

  if (!detected) {
    throw new BadRequestException(
      'Invalid or unsupported image file. Upload a valid JPEG, PNG or WebP raster image.',
    );
  }

  const normalizedDeclared =
    declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType;
  if (
    normalizedDeclared &&
    normalizedDeclared !== 'application/octet-stream' &&
    normalizedDeclared !== detected.mimeType
  ) {
    throw new BadRequestException(
      'Declared file MIME type does not match the actual image content.',
    );
  }

  if (
    !Number.isInteger(detected.width) ||
    !Number.isInteger(detected.height) ||
    detected.width < MIN_PRODUCT_IMAGE_DIMENSION ||
    detected.height < MIN_PRODUCT_IMAGE_DIMENSION ||
    detected.width > MAX_PRODUCT_IMAGE_DIMENSION ||
    detected.height > MAX_PRODUCT_IMAGE_DIMENSION ||
    detected.width * detected.height > MAX_PRODUCT_IMAGE_PIXELS
  ) {
    throw new BadRequestException(
      `${Subject} dimensions must be between ${MIN_PRODUCT_IMAGE_DIMENSION}x${MIN_PRODUCT_IMAGE_DIMENSION} and ${MAX_PRODUCT_IMAGE_DIMENSION}x${MAX_PRODUCT_IMAGE_DIMENSION} pixels (maximum ${MAX_PRODUCT_IMAGE_PIXELS} total pixels).`,
    );
  }

  return {
    mimeType: detected.mimeType,
    extension: detected.extension,
    sizeBytes,
    width: detected.width,
    height: detected.height,
  };
}
