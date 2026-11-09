import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Rebuilds public/build when a view, stylesheet or script changes. File events
// do not reach containers on Windows bind mounts, so this polls modified times.
const root = path.resolve(import.meta.dirname, '..');
const watched = ['resources/views', 'resources/css', 'resources/js'];

function newestChange(dir: string): number {
    let newest = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        newest = Math.max(
            newest,
            entry.isDirectory()
                ? newestChange(entryPath)
                : statSync(entryPath).mtimeMs,
        );
    }
    return newest;
}

function build(): void {
    spawnSync('pnpm', ['exec', 'vite', 'build'], {
        cwd: root,
        stdio: 'inherit',
    });
}

let lastBuild = 0;
build();
lastBuild = Date.now();
setInterval(() => {
    const changed = Math.max(
        ...watched.map((dir) => newestChange(path.join(root, dir))),
    );
    if (changed > lastBuild) {
        lastBuild = Date.now();
        build();
    }
}, 1000);
