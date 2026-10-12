export const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/Kikubay/AnimeLens/releases/latest';
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
export const UPDATE_CHECK_STORAGE_KEY = 'updateCheck';

export type UpdateTarget = 'chromium' | 'gecko' | 'desktop' | 'demo';

declare const __UPDATE_TARGET__: string | undefined;

export function currentUpdateTarget(): UpdateTarget {
  const injected = typeof __UPDATE_TARGET__ === 'string' ? __UPDATE_TARGET__ : null;
  if (
    injected === 'chromium' ||
    injected === 'gecko' ||
    injected === 'desktop' ||
    injected === 'demo'
  ) {
    return injected;
  }
  return 'chromium';
}

export interface UpdateSnapshot {
  readonly status: 'available' | 'up_to_date' | 'unavailable';
  readonly currentVersion: string;
  readonly latestVersion: string | null;
  readonly releaseUrl: string | null;
  readonly downloadUrl: string | null;
  readonly checkedAt: number | null;
}

export interface StoredUpdateCheck {
  readonly checkedAt: number;
  readonly snapshot: UpdateSnapshot;
}

export interface GitHubReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

export interface GitHubRelease {
  readonly tag_name: string;
  readonly html_url: string;
  readonly assets?: readonly GitHubReleaseAsset[];
}

interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

export function createInitialUpdateSnapshot(currentVersion: string): UpdateSnapshot {
  return {
    status: 'unavailable',
    currentVersion,
    latestVersion: null,
    releaseUrl: null,
    downloadUrl: null,
    checkedAt: null,
  };
}

export function buildUpdateSnapshot(
  currentVersion: string,
  release: GitHubRelease,
  checkedAt: number,
  target: UpdateTarget = currentUpdateTarget(),
): UpdateSnapshot {
  const latestVersion = normalizeVersion(release.tag_name);
  if (latestVersion === null || typeof release.html_url !== 'string') {
    return {
      ...createInitialUpdateSnapshot(currentVersion),
      checkedAt,
    };
  }

  const downloadUrl = findUpdateAssetUrl(release.assets, target);
  return {
    status: isVersionNewer(latestVersion, currentVersion) ? 'available' : 'up_to_date',
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    downloadUrl,
    checkedAt,
  };
}

export function findUpdateAssetUrl(
  assets: readonly GitHubReleaseAsset[] | undefined,
  target: UpdateTarget,
): string | null {
  if (assets === undefined || target === 'demo') return null;
  return assets.find((asset) => isUpdateAsset(asset, target))?.browser_download_url ?? null;
}

export function isUpdateAsset(asset: GitHubReleaseAsset, target: UpdateTarget): boolean {
  const name = asset.name.toLowerCase();
  if (target === 'desktop') return name.endsWith('.exe') && name.includes('-x64');
  if (target === 'gecko') return name.endsWith('-gecko.zip');
  if (target === 'chromium') return name.endsWith('-chromium.zip');
  return false;
}

export function normalizeVersion(value: string): string | null {
  const parsed = parseVersion(value);
  if (parsed === null) return null;
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${
    parsed.prerelease === null ? '' : `-${parsed.prerelease}`
  }`;
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (leftVersion === null || rightVersion === null) return 0;
  if (leftVersion.major !== rightVersion.major) return leftVersion.major - rightVersion.major;
  if (leftVersion.minor !== rightVersion.minor) return leftVersion.minor - rightVersion.minor;
  if (leftVersion.patch !== rightVersion.patch) return leftVersion.patch - rightVersion.patch;
  if (leftVersion.prerelease === rightVersion.prerelease) return 0;
  if (leftVersion.prerelease === null) return 1;
  if (rightVersion.prerelease === null) return -1;
  return comparePrerelease(leftVersion.prerelease, rightVersion.prerelease);
}

export function isVersionNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

export function isGitHubRelease(value: unknown): value is GitHubRelease {
  if (typeof value !== 'object' || value === null) return false;
  const release = value as Record<string, unknown>;
  if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') return false;
  if (release.assets === undefined) return true;
  return (
    Array.isArray(release.assets) &&
    release.assets.every((asset) => {
      if (typeof asset !== 'object' || asset === null) return false;
      const candidate = asset as Record<string, unknown>;
      return (
        typeof candidate.name === 'string' && typeof candidate.browser_download_url === 'string'
      );
    })
  );
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim());
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function comparePrerelease(left: string, right: string): number {
  const leftParts = left.split('.');
  const rightParts = right.split('.');
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}
