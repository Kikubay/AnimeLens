import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The release bump is deliberately not distributed. This entry point is the committed half; the
// implementation lives in an untracked file, so a clone can never run a release bump by accident.
const IMPLEMENTATION = join(ROOT, 'scripts', 'bump-manifest.mjs');

const RESTRICTED_MESSAGE = [
  'Release bumping is restricted to the repository maintainer.',
  '',
  'This checkout does not include scripts/bump-manifest.mjs, which performs the bump.',
  'It is excluded from version control on purpose and is never pushed.',
].join('\n');

let present = true;
try {
  await access(IMPLEMENTATION);
} catch {
  present = false;
}

if (!present) {
  console.error(RESTRICTED_MESSAGE);
  process.exit(1);
}

const { spawn } = await import('node:child_process');
const child = spawn(process.execPath, [IMPLEMENTATION, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
