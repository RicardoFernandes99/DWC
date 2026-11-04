import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const template = await readFile(new URL('.env.example', root), 'utf8');
const local = template
  .replace(
    'replace-with-local-access-key',
    `dwc${randomBytes(8).toString('hex')}`,
  )
  .replace('replace-with-local-secret-key', randomBytes(32).toString('hex'))
  .replace('replace-with-jwt-secret', randomBytes(48).toString('hex'));

try {
  await writeFile(new URL('.env', root), local, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with local development credentials.');
} catch (error) {
  if (
    !(error instanceof Error) ||
    !('code' in error) ||
    error.code !== 'EEXIST'
  )
    throw error;
  const existing = await readFile(new URL('.env', root), 'utf8');
  if (!/^BACKOFFICE_ORIGIN=/m.test(existing)) {
    await writeFile(
      new URL('.env', root),
      `${existing.trimEnd()}\nBACKOFFICE_ORIGIN=http://localhost:8080\n`,
    );
    console.log('Added the local backoffice origin to the existing .env.');
  }
  console.log('Existing .env preserved.');
}
