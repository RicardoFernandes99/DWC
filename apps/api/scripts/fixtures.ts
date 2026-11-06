import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function stop(message: string): never {
  console.error(`Fixture command stopped: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const mode = args[0];
if (!['--create', '--cleanup'].includes(mode ?? '') || args.length !== 1) {
  stop('Choose exactly one mode: --create or --cleanup.');
}

const mongoUri = process.env.MONGODB_URI;
if (typeof mongoUri !== 'string' || !mongoUri.trim())
  stop('MONGODB_URI is required.');
let mongoHost: string;
try {
  mongoHost = new URL(mongoUri).hostname.toLowerCase();
} catch {
  stop('MONGODB_URI is invalid.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(mongoHost)) {
  stop('MONGODB_URI must point to a local MongoDB host.');
}
if (process.env.FIXTURE_MAINTENANCE_ACK !== 'stopped') {
  stop(
    'Stop the API and other writers, then set FIXTURE_MAINTENANCE_ACK=stopped.',
  );
}

const port = Number(process.env.API_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  stop('API_PORT is invalid.');
try {
  await fetch(`http://127.0.0.1:${port}/api/health/live`, {
    signal: AbortSignal.timeout(1000),
  });
  stop(`An API responds on port ${port}. Stop it before using fixtures.`);
} catch (error) {
  if (error instanceof Error && error.message.includes('An API responds'))
    throw error;
  if (!(
    error instanceof TypeError &&
    error.cause instanceof Error &&
    'code' in error.cause &&
    error.cause.code === 'ECONNREFUSED'
  )) {
    stop(
      `Could not confirm that API port ${port} is stopped. Check the port and retry.`,
    );
  }
}

const apiRoot = process.cwd();
const nestCli = resolve(apiRoot, 'node_modules/@nestjs/cli/bin/nest.js');
const build = spawnSync(process.execPath, [nestCli, 'build'], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: process.env,
});
if (build.error) stop('Could not start the API build.');
if (build.status !== 0)
  stop('The API build failed. Fixture data was not changed.');

const implementation = resolve(apiRoot, 'dist/local-demo-fixtures.js');
const run = spawnSync(process.execPath, [implementation, mode!], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: process.env,
});
if (run.error) stop('Could not start the fixture command.');
if (run.status !== 0) process.exitCode = run.status ?? 1;
