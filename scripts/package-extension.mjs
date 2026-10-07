import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZipArchive } from 'archiver';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Matches `directories.output` in electron-builder.yml, so artifacts land in one place. */
const RELEASE_DIR = 'release';

/** Directories follow the engine (`chromium` covers Chrome, Edge, Brave and Opera; `gecko` is Firefox), but the filename keeps the browser name a store would recognise. */
const TARGETS = [
  { id: 'chromium', dir: 'dist/chromium' },
  { id: 'firefox', dir: 'dist/gecko' },
];

async function collectFiles(dir, skipDirName) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
// The archive lands inside the source tree, so a second run would otherwise nest the previous zip inside the next one.
      if (entry.name === skipDirName) continue;
      files.push(...(await collectFiles(full, skipDirName)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function zipDirectory(sourceDir, outFile) {
  const files = await collectFiles(sourceDir, RELEASE_DIR);
  if (files.length === 0) throw new Error(`Nothing to package in ${sourceDir}`);

  await mkdir(dirname(outFile), { recursive: true });

  await new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(outFile);
    // Manifest first so a truncated upload fails validation loudly rather than silently.
    const ordered = [
      ...files.filter((file) => file.endsWith('manifest.json')),
      ...files.filter((file) => !file.endsWith('manifest.json')),
    ];

    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolvePromise);
    archive.on('warning', rejectPromise);
    archive.on('error', rejectPromise);
    archive.pipe(output);
    for (const file of ordered) {
      archive.file(file, { name: relative(sourceDir, file).split(sep).join('/') });
    }
    void archive.finalize();
  });

  return files.length;
}

const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

for (const target of TARGETS) {
  const sourceDir = join(ROOT, target.dir);
  const outFile = join(ROOT, target.dir, RELEASE_DIR, `animelens-${version}-${target.id}.zip`);
  const count = await zipDirectory(sourceDir, outFile);
  console.log(`${target.id}: ${count} files -> ${relative(ROOT, outFile)}`);
}
