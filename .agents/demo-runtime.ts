import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const demoRoot = resolve(root, 'demos');

export function demoPath(input: string): string {
  const file = resolve(root, input);
  const rel = relative(demoRoot, file);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(
      'Demo files must live under this repository’s demos/ folder.',
    );
  }
  return file;
}

export function demoEnvironment(): NodeJS.ProcessEnv {
  const key = createHash('sha256').update(root).digest('hex').slice(0, 10);
  mkdirSync(demoRoot, { recursive: true });
  return {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      resolve(root, 'node_modules/.cache/ms-playwright'),
    DEMO_PROJECT: resolve(root, '.agents/record-demo.ts'),
    PRODUCE_DEMO_PROJECT: resolve(root, '.agents/produce-demo.ts'),
    DEMO_STATE:
      process.env.DEMO_STATE || resolve(tmpdir(), `dwc-demo-${key}.state`),
  };
}

export function runEngine(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: root,
    env: demoEnvironment(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
