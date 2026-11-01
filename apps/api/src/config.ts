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
  ];
  for (const name of required) {
    if (typeof input[name] !== 'string' || !input[name]) {
      throw new Error(
        `Missing ${name}. Run pnpm setup:local from the repository root.`,
      );
    }
  }
  const port = Number(input.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }
  for (const name of ['S3_ENDPOINT', 'WEB_ORIGIN']) {
    const value = input[name];
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
