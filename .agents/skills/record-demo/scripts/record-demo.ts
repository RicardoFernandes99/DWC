import { resolve } from 'node:path';
import { demoPath, root, runEngine } from '../../../demo-runtime.ts';

const args = process.argv.slice(2);
if (args[0] === 'doctor') {
  runEngine('bash', [
    resolve(root, '.agents/skills/record-demo/scripts/doctor.sh'),
  ]);
} else {
  if (args[0] === 'start') {
    if (!args[1])
      throw new Error(
        'Usage: pnpm demo:record start demos/takes/name.webm [url] [ready-selector]',
      );
    args[1] = demoPath(args[1]);
  }
  runEngine('bash', [
    resolve(root, '.agents/skills/record-demo/scripts/record-demo.sh'),
    ...args,
  ]);
}
