import { spawnSync } from 'node:child_process';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'apps', 'backoffice');
const envPath = path.join(app, '.env');
const compose = ['compose', '-f', path.join(root, 'compose.yaml')];
const mode = process.argv[2];

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function dockerPath(value: string): string {
  return value.replaceAll('\\', '/');
}

async function prepareEnvironment(): Promise<void> {
  try {
    await readFile(envPath, 'utf8');
  } catch {
    await copyFile(path.join(app, '.env.example'), envPath);
  }

  let contents = await readFile(envPath, 'utf8');
  const originalContents = contents;
  const defaults: Record<string, string> = {
    APP_NAME: '"DWC Backoffice"',
    APP_ENV: 'local',
    APP_DEBUG: 'false',
    APP_URL: 'http://localhost:8080',
    BACKOFFICE_ORIGIN: 'http://localhost:8080',
    NEST_API_URL: 'http://host.docker.internal:3000/api',
    SESSION_SECURE_COOKIE: 'false',
    SESSION_HTTP_ONLY: 'true',
    SESSION_SAME_SITE: 'lax',
    CACHE_STORE: 'file',
    LOG_CHANNEL: 'stderr',
    LOG_LEVEL: 'warning',
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (!new RegExp(`^${key}=`, 'm').test(contents)) {
      contents = `${contents.trimEnd()}\n${key}=${value}\n`;
    }
  }
  if (contents !== originalContents) {
    await writeFile(envPath, contents, { mode: 0o600 });
  }
}

if (mode === 'setup') {
  await prepareEnvironment();
  const volume = `type=bind,source=${dockerPath(app)},target=/app`;
  run('docker', [
    'run',
    '--rm',
    '--mount',
    volume,
    '-w',
    '/app',
    'composer:2',
    'composer',
    'install',
    '--no-interaction',
    '--prefer-dist',
  ]);
  const contents = await readFile(envPath, 'utf8');
  if (/^APP_KEY=\s*$/m.test(contents)) {
    run('docker', [
      'run',
      '--rm',
      '--mount',
      volume,
      '-w',
      '/app',
      'composer:2',
      'php',
      'artisan',
      'key:generate',
    ]);
  }
  console.log('Backoffice dependencies and local configuration are ready.');
} else if (mode === 'dev') {
  await prepareEnvironment();
  run('docker', [
    ...compose,
    '--profile',
    'backoffice',
    'up',
    '--build',
    'backoffice',
  ]);
} else if (mode === 'check') {
  await prepareEnvironment();
  run('docker', [
    ...compose,
    '--profile',
    'backoffice',
    'run',
    '--rm',
    '--build',
    '--no-deps',
    'backoffice',
    'composer',
    'check-platform-reqs',
  ]);
  run('docker', [
    ...compose,
    '--profile',
    'backoffice',
    'run',
    '--rm',
    '--no-deps',
    'backoffice',
    'php',
    'vendor/bin/pint',
    '--test',
  ]);
  run('docker', [
    ...compose,
    '--profile',
    'backoffice',
    'run',
    '--rm',
    '--no-deps',
    'backoffice',
    'php',
    'vendor/bin/phpstan',
    'analyse',
    '--no-progress',
  ]);
} else if (mode === 'format') {
  await prepareEnvironment();
  run('docker', [
    ...compose,
    '--profile',
    'backoffice',
    'run',
    '--rm',
    '--build',
    '--no-deps',
    'backoffice',
    'php',
    'vendor/bin/pint',
  ]);
} else {
  throw new Error('Use setup, dev, check or format.');
}
