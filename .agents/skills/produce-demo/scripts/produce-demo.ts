import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { demoPath, root, runEngine } from '../../../demo-runtime.ts';

const args = process.argv.slice(2);
const { positionals, values } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    draft: { type: 'boolean' },
    keep: { type: 'boolean' },
    every: { type: 'string' },
    port: { type: 'string' },
    wait: { type: 'boolean' },
    to: { type: 'string' },
  },
});
const [command, target] = positionals;
let output: string | undefined;
if (target && command !== 'doctor') demoPath(target);
if (command === 'build') {
  if (!target) throw new Error('A storyboard under demos/ is required.');
  const suffix = values.draft ? '.draft.mp4' : '.mp4';
  output = demoPath(
    values.out ?? target.replace(/\.storyboard\.json$|\.json$/, '') + suffix,
  );
  if (!output.endsWith('.mp4'))
    throw new Error('Video output must end in .mp4.');
  if (!values.out) args.push('--out', output);
}
runEngine(process.execPath, [
  resolve(root, '.agents/skills/produce-demo/scripts/produce-demo.mjs'),
  ...args,
]);
if (output) {
  const seconds = Number(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=nw=1:nk=1',
        output,
      ],
      { encoding: 'utf8' },
    ).trim(),
  );
  if (!Number.isFinite(seconds) || seconds > 300) {
    console.error(
      `Video saved locally, but its duration (${seconds}s) does not meet DWC’s five-minute limit. Shorten the storyboard and rebuild.`,
    );
    process.exitCode = 1;
  }
}
