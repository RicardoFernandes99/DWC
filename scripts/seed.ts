// Loads the local demo data into the MongoDB from .env. Run it before the API
// starts: the fixture command refuses to run while an API answers on API_PORT.
// The Docker stack does this by itself (see the `seed` service in compose.yaml).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// pnpm forwards the `--` separator, so drop it before reading the mode.
const mode =
  process.argv.slice(2).find((argument) => argument !== '--') ?? '--create';
if (!['--create', '--cleanup'].includes(mode)) {
  console.error('Usage: pnpm seed [-- --cleanup]');
  process.exit(1);
}

const result = spawnSync('pnpm', ['--filter', '@dwc/api', 'fixtures', mode], {
  cwd: root,
  stdio: 'inherit',
  // pnpm is a .cmd shim on Windows; the arguments are fixed, so a shell is safe.
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    FIXTURE_MAINTENANCE_ACK: 'stopped',
    FIXTURE_PASSWORD: process.env.FIXTURE_PASSWORD ?? 'DwcDemo-Local-2026',
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
