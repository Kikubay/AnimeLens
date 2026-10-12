import { describe, expect, it } from 'vitest';
import {
  buildUpdateSnapshot,
  compareVersions,
  findUpdateAssetUrl,
  isGitHubRelease,
  isUpdateAsset,
  normalizeVersion,
} from '../src/updates/update-checker';

const RELEASE_URL = 'https://github.com/Kikubay/AnimeLens/releases/tag/v0.1.2';
const DOWNLOAD_BASE = 'https://github.com/Kikubay/AnimeLens/releases/download/v0.1.2';

const RELEASE = {
  tag_name: 'v0.1.2',
  html_url: RELEASE_URL,
  assets: [
    {
      name: 'animelens-0.1.2-chromium.zip',
      browser_download_url: `${DOWNLOAD_BASE}/animelens-0.1.2-chromium.zip`,
    },
    {
      name: 'animelens-0.1.2-gecko.zip',
      browser_download_url: `${DOWNLOAD_BASE}/animelens-0.1.2-gecko.zip`,
    },
    {
      name: 'AnimeLens-0.1.2-x64.exe',
      browser_download_url: `${DOWNLOAD_BASE}/AnimeLens-0.1.2-x64.exe`,
    },
  ],
};

describe('update checker', () => {
  it('normalizes release tags with or without a v prefix', () => {
    expect(normalizeVersion('v0.1.2')).toBe('0.1.2');
    expect(normalizeVersion('0.1.2')).toBe('0.1.2');
    expect(normalizeVersion('release-0.1.2')).toBeNull();
  });

  it('compares stable and prerelease semantic versions', () => {
    expect(compareVersions('0.1.2', '0.1.1')).toBeGreaterThan(0);
    expect(compareVersions('0.1.1', '0.1.1')).toBe(0);
    expect(compareVersions('0.1.1-beta.2', '0.1.1-beta.10')).toBeLessThan(0);
    expect(compareVersions('0.1.1', '0.1.1-beta.10')).toBeGreaterThan(0);
  });

  it('marks a release as available only when it is newer', () => {
    const snapshot = buildUpdateSnapshot('0.1.1', RELEASE, 123, 'chromium');

    expect(snapshot).toMatchObject({
      status: 'available',
      latestVersion: '0.1.2',
      releaseUrl: RELEASE_URL,
      downloadUrl: `${DOWNLOAD_BASE}/animelens-0.1.2-chromium.zip`,
      checkedAt: 123,
    });
    expect(buildUpdateSnapshot('0.1.2', RELEASE, 123, 'chromium').status).toBe('up_to_date');
    expect(buildUpdateSnapshot('0.2.0', RELEASE, 123, 'chromium').status).toBe('up_to_date');
  });

  it('gives the desktop build its own installer rather than a browser zip', () => {
    const snapshot = buildUpdateSnapshot('0.1.1', RELEASE, 123, 'desktop');
    expect(snapshot.downloadUrl).toBe(`${DOWNLOAD_BASE}/AnimeLens-0.1.2-x64.exe`);
  });

  it('never hands one extension the other one package', () => {
    const gecko = buildUpdateSnapshot('0.1.1', RELEASE, 123, 'gecko');
    const chromium = buildUpdateSnapshot('0.1.1', RELEASE, 123, 'chromium');
    expect(gecko.downloadUrl).toBe(`${DOWNLOAD_BASE}/animelens-0.1.2-gecko.zip`);
    expect(chromium.downloadUrl).toBe(`${DOWNLOAD_BASE}/animelens-0.1.2-chromium.zip`);
    expect(gecko.downloadUrl).not.toBe(chromium.downloadUrl);
  });

  it('offers no download when the release has no package for this target', () => {
    const zipsOnly = {
      tag_name: 'v0.1.2',
      html_url: RELEASE_URL,
      assets: RELEASE.assets.slice(0, 2),
    };
    expect(buildUpdateSnapshot('0.1.1', zipsOnly, 123, 'desktop').downloadUrl).toBeNull();
    expect(findUpdateAssetUrl(undefined, 'chromium')).toBeNull();
    expect(findUpdateAssetUrl(RELEASE.assets, 'demo')).toBeNull();
  });

  it('refuses an untargeted zip rather than guessing which target it is for', () => {
    const stray = {
      name: 'animelens-0.1.2.zip',
      browser_download_url: 'https://example.test/a.zip',
    };
    expect(isUpdateAsset(stray, 'chromium')).toBe(false);
    expect(isUpdateAsset(stray, 'gecko')).toBe(false);
    expect(isUpdateAsset(stray, 'desktop')).toBe(false);
  });

  it('only treats a windows x64 executable as the desktop package', () => {
    const exe = { name: 'AnimeLens-0.1.2-x64.exe', browser_download_url: 'https://example.test/a' };
    const arm = {
      name: 'AnimeLens-0.1.2-arm64.exe',
      browser_download_url: 'https://example.test/b',
    };
    expect(isUpdateAsset(exe, 'desktop')).toBe(true);
    expect(isUpdateAsset(arm, 'desktop')).toBe(false);
  });

  it('matches package names case-insensitively', () => {
    const upper = {
      name: 'ANIMELENS-0.1.2-GECKO.ZIP',
      browser_download_url: 'https://example.test/c',
    };
    expect(isUpdateAsset(upper, 'gecko')).toBe(true);
  });

  it('picks the target package regardless of asset order', () => {
    const reversed = [...RELEASE.assets].reverse();
    expect(findUpdateAssetUrl(reversed, 'gecko')).toBe(
      `${DOWNLOAD_BASE}/animelens-0.1.2-gecko.zip`,
    );
    expect(findUpdateAssetUrl(reversed, 'desktop')).toBe(
      `${DOWNLOAD_BASE}/AnimeLens-0.1.2-x64.exe`,
    );
  });

  it('falls back to unavailable when the tag cannot be read', () => {
    const snapshot = buildUpdateSnapshot(
      '0.1.1',
      { tag_name: 'nightly', html_url: RELEASE_URL, assets: RELEASE.assets },
      123,
      'chromium',
    );
    expect(snapshot).toMatchObject({
      status: 'unavailable',
      downloadUrl: null,
      latestVersion: null,
    });
  });

  it('validates the minimum GitHub release shape', () => {
    expect(isGitHubRelease({ tag_name: 'v0.1.2', html_url: 'https://github.com/release' })).toBe(
      true,
    );
    expect(isGitHubRelease({ tag_name: 'v0.1.2' })).toBe(false);
  });
});
