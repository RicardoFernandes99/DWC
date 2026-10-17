import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const assets = new URL('../dist/assets/', import.meta.url);
const files = (await readdir(assets)).filter((file) => file.endsWith('.js'));
const output = (
  await Promise.all(
    files.map((file) => readFile(new URL(file, assets), 'utf8')),
  )
).join('\n');
assert.ok(
  output.includes('react.memo_cache_sentinel'),
  'React Compiler output missing from production bundle',
);
console.log('React Compiler output verified.');
