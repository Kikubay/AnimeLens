import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  readonly version: string;
}

interface Lockfile {
  readonly version: string;
  readonly packages: Readonly<Record<string, PackageManifest>>;
}

interface ExtensionManifest {
  readonly version: string;
}

function readJson<T>(...segments: readonly string[]): T {
  return JSON.parse(readFileSync(resolve(__dirname, '..', ...segments), 'utf8')) as T;
}

const pkg = readJson<PackageManifest>('package.json');
const lock = readJson<Lockfile>('package-lock.json');
const manifest = readJson<ExtensionManifest>('public', 'manifest.json');

describe('release version', () => {
  it('matches the extension manifest', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('matches both version fields in the lockfile', () => {
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages['']?.version).toBe(pkg.version);
  });

  it('is a semver string, so `npm version` can parse it', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('the release bump is restricted to the maintainer', () => {
  const scripts = readJson<{ readonly scripts: Record<string, string> }>('package.json').scripts;
  const guard = readFileSync(resolve(__dirname, '..', 'scripts', 'bump.mjs'), 'utf8');

  it('routes every version script through the committed guard', () => {
    expect(scripts.bump).toBe('node scripts/bump.mjs');
    expect(scripts['check:version']).toBe('node scripts/bump.mjs --check');
    expect(scripts['fix:version']).toBe('node scripts/bump.mjs --fix');
  });

  it('refuses when the untracked implementation is absent', () => {
    expect(guard).toContain('access(IMPLEMENTATION)');
    expect(guard).toContain('bump-manifest.mjs');
    expect(guard).toContain('restricted to the repository maintainer');
    expect(guard).toContain('process.exit(1)');
  });

  it('keeps the capability out of the committed script', () => {
    expect(guard).not.toContain('npm version');
    expect(guard).not.toContain('JSON.stringify(manifest');
  });
});
