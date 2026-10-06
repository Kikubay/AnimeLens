import type { AppCopy } from '../locales';
import {
  DEFAULT_TASTE_CARD_RENDER_OPTIONS,
  TASTE_CARD_FORMATS,
  type TasteCardFormat,
  type TasteCardModel,
  type TasteCardRenderOptions,
} from '../profile/taste-card-types';
import { paintTasteCard } from './taste-card-painter';

const DEFAULT_TIMEOUT_MS = 12000;
// Guards against inlining an unexpectedly huge asset.
const MAX_ASSET_BYTES = 4 * 1024 * 1024;

// 2x supersampling keeps the small type and rounded bar edges crisp when the PNG is zoomed or opened full-size; the cost is ~4x the encode work.
export const TASTE_CARD_EXPORT_SCALE = 2;

export class TasteCardRenderError extends Error {
  readonly reason: 'asset' | 'render' | 'encode';

  constructor(reason: TasteCardRenderError['reason'], message: string) {
    super(message);
    this.name = 'TasteCardRenderError';
    this.reason = reason;
  }
}

// The provider CDNs serve avatars without CORS headers, so the bytes are fetched (allowed by host_permissions) and inlined as a data URL to keep the canvas same-origin. Any failure returns null so the card degrades to a monogram instead of failing the export.
export async function fetchAssetAsDataUrl(
  url: string | null,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  if (url === null || url.trim().length === 0) return null;
  try {
    const blob = await withTimeout(
      (async () => {
        const response = await fetch(url, { credentials: 'omit', cache: 'no-cache' });
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.length > 0 && !contentType.startsWith('image/')) return null;
        const payload = await response.blob();
        return payload.size > MAX_ASSET_BYTES ? null : payload;
      })(),
      timeoutMs,
    );
    return blob === null ? null : await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export function fetchBrandAssetAsDataUrl(): Promise<string | null> {
  return fetchAssetAsDataUrl(chrome.runtime.getURL('icons/icon128.png'));
}

export interface RenderTasteCardOptions {
  readonly model: TasteCardModel;
  readonly format: TasteCardFormat;
  readonly copy: AppCopy;
  /** `null` falls back to the monogram. */
  readonly avatarDataUrl?: string | null;
  readonly brandDataUrl?: string | null;
  /** Positionally aligned with `model.topPicks`. */
  readonly pickDataUrls?: readonly (string | null)[];
  readonly options?: TasteCardRenderOptions;
  readonly scale?: number;
  readonly timeoutMs?: number;
}

// Produces both the modal preview and the downloaded file, so the two can never disagree.
export async function renderTasteCardPng(options: RenderTasteCardOptions): Promise<Blob> {
  const {
    model,
    format,
    copy,
    avatarDataUrl,
    brandDataUrl,
    pickDataUrls = [],
    options: renderOptions = DEFAULT_TASTE_CARD_RENDER_OPTIONS,
    scale = TASTE_CARD_EXPORT_SCALE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const spec = TASTE_CARD_FORMATS[format];

  // Decode before painting so a broken asset can't abort the export, and skip hidden covers entirely rather than paying for CDN downloads nothing will draw.
  const drawsPicks = renderOptions.showPicks && model.topPicks.length > 0;
  const decoded = await Promise.all([
    decodeImage(avatarDataUrl, timeoutMs),
    decodeImage(brandDataUrl, timeoutMs),
    ...(drawsPicks
      ? model.topPicks.map((_, index) => decodeImage(pickDataUrls[index], timeoutMs))
      : []),
  ]);
  const [avatar, brand, ...picks] = decoded;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.width * scale);
  canvas.height = Math.round(spec.height * scale);
  try {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new TasteCardRenderError('render', 'Canvas 2D context unavailable.');
    }
    paintTasteCard(context, {
      model,
      format,
      copy,
      scale,
      options: renderOptions,
      images: { avatar, brand, picks },
    });
    return await canvasToPngBlob(canvas);
  } finally {
    // Extension popups are memory constrained, so drop the backing store.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Chrome needs the URL to outlive the click by a tick to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export type ClipboardOutcome = 'copied' | 'unsupported' | 'denied';

export async function copyPngBlobToClipboard(blob: Blob): Promise<ClipboardOutcome> {
  if (typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
    return 'unsupported';
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  } catch {
    // Missing user gesture or a policy denial — both recoverable, the caller falls back to downloading.
    return 'denied';
  }
}

async function decodeImage(
  dataUrl: string | null | undefined,
  timeoutMs: number,
): Promise<CanvasImageSource | null> {
  if (dataUrl === null || dataUrl === undefined || dataUrl.length === 0) return null;
  try {
    return await withTimeout(
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new TasteCardRenderError('asset', 'Image decode failed.'));
        image.src = dataUrl;
      }),
      timeoutMs,
    );
  } catch {
    return null;
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new TasteCardRenderError('encode', 'The taste card could not be encoded as PNG.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new TasteCardRenderError('asset', 'Unable to inline the image asset.'));
    };
    reader.onerror = () =>
      reject(new TasteCardRenderError('asset', 'Unable to inline the image asset.'));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new TasteCardRenderError('asset', 'The request timed out.')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
