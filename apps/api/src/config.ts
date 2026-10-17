export function validateEnvironment(input: Record<string, unknown>) {
  const required = [
    'MONGODB_URI',
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
    const url = new URL(input[name] as string);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${name} must use HTTP or HTTPS.`);
    }
  }
  return { ...input, API_PORT: port };
}
