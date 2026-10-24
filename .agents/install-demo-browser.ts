import { resolve } from 'node:path';
import { root, runEngine } from './demo-runtime.ts';

runEngine(process.execPath, [
  resolve(root, 'node_modules/playwright/cli.js'),
  'install',
  'chromium',
]);
