export function validateEnvironment(input: Record<string, unknown>) {
  const required = [
    'MONGODB_URI',
    'REDIS_URL',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'WEB_ORIGIN',
    'BACKOFFICE_ORIGIN',
    'JWT_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'AUTH_COOKIE_SECURE',
  ];
  for (const name of required) {
    if (typeof input[name] !== 'string' || !input[name]) {
      throw new Error(
        `Missing ${name}. Run pnpm setup:local from the repository root.`,
      );
    }
  }
  const port = Number(input.API_PORT ?? 3000);
  if (
    typeof input.JWT_SECRET !== 'string' ||
    input.JWT_SECRET.length < 32 ||
    input.JWT_SECRET.startsWith('replace-')
  ) {
    throw new Error(
      'JWT_SECRET must be a generated secret of at least 32 characters.',
    );
  }
  if (!['true', 'false'].includes(String(input.AUTH_COOKIE_SECURE)))
    throw new Error('AUTH_COOKIE_SECURE must explicitly be true or false.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }
  for (const name of [
    'S3_ENDPOINT',
    'S3_PUBLIC_ENDPOINT',
    'WEB_ORIGIN',
    'BACKOFFICE_ORIGIN',
  ]) {
    const value = input[name];
    if (name === 'S3_PUBLIC_ENDPOINT' && (value === undefined || value === ''))
      continue;
    if (typeof value !== 'string') {
      throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${name} must use HTTP or HTTPS.`);
    }
    if (name === 'WEB_ORIGIN' || name === 'BACKOFFICE_ORIGIN') {
      if (url.origin !== value)
        throw new Error(
          `${name} must be an exact origin without a path or trailing slash.`,
        );
      if (url.protocol === 'https:' && input.AUTH_COOKIE_SECURE !== 'true')
        throw new Error('HTTPS requires AUTH_COOKIE_SECURE=true.');
    }
  }
  const redisUrl = input.REDIS_URL;
  if (typeof redisUrl !== 'string') {
    throw new Error('REDIS_URL must be a valid redis or rediss URL.');
  }
  let parsedRedisUrl: URL;
  try {
    parsedRedisUrl = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid redis or rediss URL.');
  }
  try {
    decodeURIComponent(parsedRedisUrl.username);
    decodeURIComponent(parsedRedisUrl.password);
  } catch {
    throw new Error('REDIS_URL must contain valid encoded credentials.');
  }
  if (
    !['redis:', 'rediss:'].includes(parsedRedisUrl.protocol) ||
    !parsedRedisUrl.hostname ||
    (parsedRedisUrl.port !== '' && Number(parsedRedisUrl.port) === 0) ||
    !/^(?:\/(?:\d+)?)?$/.test(parsedRedisUrl.pathname) ||
    parsedRedisUrl.hash !== ''
  ) {
    throw new Error(
      'REDIS_URL must use redis: or rediss:, include a host, and use a numeric database path.',
    );
  }
  return { ...input, API_PORT: port };
}
