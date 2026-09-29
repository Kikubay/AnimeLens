import { describe, expect, it } from 'vitest';
import {
  buildUpdateSnapshot,
  compareVersions,
  isGitHubRelease,
  normalizeVersion,
} from '../src/updates/update-checker';

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
    const snapshot = buildUpdateSnapshot(
      '0.1.1',
      {
        tag_name: 'v0.1.2',
        html_url: 'https://github.com/Kikubay/AnimeLens/releases/tag/v0.1.2',
        assets: [
          {
            name: 'animelens-0.1.2.zip',
            browser_download_url:
              'https://github.com/Kikubay/AnimeLens/releases/download/v0.1.2/animelens-0.1.2.zip',
          },
        ],
      },
      123,
    );

    expect(snapshot).toMatchObject({
      status: 'available',
      latestVersion: '0.1.2',
      downloadUrl:
        'https://github.com/Kikubay/AnimeLens/releases/download/v0.1.2/animelens-0.1.2.zip',
      checkedAt: 123,
    });
  });

  it('validates the minimum GitHub release shape', () => {
    expect(isGitHubRelease({ tag_name: 'v0.1.2', html_url: 'https://github.com/release' })).toBe(
      true,
    );
    expect(isGitHubRelease({ tag_name: 'v0.1.2' })).toBe(false);
  });
});
