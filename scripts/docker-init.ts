// Runs in the Compose `init` container before the app services start, so a fresh
// clone needs only `docker compose --profile app up`. Never overwrites existing values.
import { randomBytes } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';

await import('./setup-local.ts');

const example = new URL('../apps/backoffice/.env.example', import.meta.url);
const env = new URL('../apps/backoffice/.env', import.meta.url);
try {
  await copyFile(example, env, 1 /* COPYFILE_EXCL */);
  console.log('Created apps/backoffice/.env from the example.');
} catch (error) {
  if (
    !(error instanceof Error) ||
    !('code' in error) ||
    error.code !== 'EEXIST'
  )
    throw error;
}

const contents = await readFile(env, 'utf8');
if (/^APP_KEY=\s*$/m.test(contents)) {
  const key = `base64:${randomBytes(32).toString('base64')}`;
  await writeFile(env, contents.replace(/^APP_KEY=\s*$/m, `APP_KEY=${key}`), {
    mode: 0o600,
  });
  console.log('Generated the backoffice APP_KEY.');
}
