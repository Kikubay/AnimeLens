import type { AppCopy } from '../locales';
import type { PaletteId } from '../profile/cosmetics';
import {
  DEFAULT_TASTE_CARD_RENDER_OPTIONS,
  TASTE_CARD_FORMATS,
  type TasteCardFormat,
  type TasteCardModel,
  type TasteCardRenderOptions,
} from '../profile/taste-card-types';
import { paintTasteCard, type TasteCardImages } from './taste-card-painter';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const DECODED_IMAGE_CACHE_LIMIT = 12;
const GIF_PALETTE_SAMPLE_WIDTH = 256;
const GIF_PALETTE_SAMPLE_COUNT = 8;

export const TASTE_CARD_EXPORT_SCALE = 2;
export const TASTE_CARD_GIF_DITHER_STRENGTH = 6;

interface TasteCardGifTiming {
  readonly frames: number;
  readonly delayMs: number;
}

const TASTE_CARD_GIF_THEMES: Readonly<Record<PaletteId, TasteCardGifTiming>> = {
  'palette-aurora': { frames: 80, delayMs: 125 },
  'palette-tide': { frames: 48, delayMs: 125 },
  'palette-ember': { frames: 40, delayMs: 100 },
  'palette-mono': { frames: 48, delayMs: 125 },
};

const DEFAULT_TASTE_CARD_GIF_TIMING = TASTE_CARD_GIF_THEMES['palette-aurora'];

export const TASTE_CARD_GIF_WIDTH = 900;

function tasteCardGifTiming(palette: PaletteId | undefined): TasteCardGifTiming {
  return TASTE_CARD_GIF_THEMES[palette ?? 'palette-aurora'] ?? DEFAULT_TASTE_CARD_GIF_TIMING;
}

export function tasteCardGifLoopMs(palette: PaletteId | undefined): number {
  const { frames, delayMs } = tasteCardGifTiming(palette);
  return frames * delayMs;
}

const BAYER_MATRIX = new Uint8Array([
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]);

class TasteCardRenderError extends Error {
  readonly reason: 'asset' | 'render' | 'encode';

  constructor(reason: TasteCardRenderError['reason'], message: string) {
    super(message);
    this.name = 'TasteCardRenderError';
    this.reason = reason;
  }
}

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
  readonly avatarDataUrl?: string | null;
  readonly brandDataUrl?: string | null;
  readonly pickDataUrls?: readonly (string | null)[];
  readonly options?: TasteCardRenderOptions;
  readonly scale?: number;
  readonly timeoutMs?: number;
}

export interface TasteCardFrameRequest {
  readonly model: TasteCardModel;
  readonly format: TasteCardFormat;
  readonly copy: AppCopy;
  readonly images: TasteCardImages;
  readonly options: TasteCardRenderOptions;
}

export function paintTasteCardFrame(
  context: CanvasRenderingContext2D,
  request: TasteCardFrameRequest,
  width: number,
  height: number,
  progress?: number,
): void {
  context.clearRect(0, 0, width, height);
  paintTasteCard(context, {
    model: request.model,
    format: request.format,
    copy: request.copy,
    scale: width / TASTE_CARD_FORMATS[request.format].width,
    options: request.options,
    progress,
    images: request.images,
  });
}

interface TasteCardAssetSources {
  readonly avatarDataUrl?: string | null;
  readonly brandDataUrl?: string | null;
  readonly pickDataUrls?: readonly (string | null)[];
}

export async function resolveTasteCardImages(
  sources: TasteCardAssetSources,
  drawsPicks: boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<TasteCardImages> {
  const picks = drawsPicks ? (sources.pickDataUrls ?? []) : [];
  const decoded = await Promise.all([
    decodeImage(sources.avatarDataUrl, timeoutMs),
    decodeImage(sources.brandDataUrl, timeoutMs),
    ...picks.map((pick) => decodeImage(pick, timeoutMs)),
  ]);
  const [avatar, brand, ...pickImages] = decoded;
  return { avatar, brand, picks: pickImages };
}

export async function renderTasteCardPng(options: RenderTasteCardOptions): Promise<Blob> {
  const {
    model,
    format,
    copy,
    avatarDataUrl,
    brandDataUrl,
    pickDataUrls,
    options: renderOptions = DEFAULT_TASTE_CARD_RENDER_OPTIONS,
    scale = TASTE_CARD_EXPORT_SCALE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const spec = TASTE_CARD_FORMATS[format];

  const images = await resolveTasteCardImages(
    { avatarDataUrl, brandDataUrl, pickDataUrls },
    renderOptions.showPicks && model.topPicks.length > 0,
    timeoutMs,
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.width * scale);
  canvas.height = Math.round(spec.height * scale);
  try {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new TasteCardRenderError('render', 'Canvas 2D context unavailable.');
    }
    paintTasteCardFrame(
      context,
      { model, format, copy, images, options: renderOptions },
      canvas.width,
      canvas.height,
    );
    return await canvasToPngBlob(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export interface RenderTasteCardGifOptions {
  readonly model: TasteCardModel;
  readonly format: TasteCardFormat;
  readonly copy: AppCopy;
  readonly avatarDataUrl?: string | null;
  readonly brandDataUrl?: string | null;
  readonly pickDataUrls?: readonly (string | null)[];
  readonly options?: TasteCardRenderOptions;
  readonly frames?: number;
  readonly delayMs?: number;
  readonly gifWidth?: number;
  readonly timeoutMs?: number;
}

export async function renderTasteCardGif(options: RenderTasteCardGifOptions): Promise<Blob> {
  const {
    model,
    format,
    copy,
    avatarDataUrl,
    brandDataUrl,
    pickDataUrls,
    options: renderOptions = DEFAULT_TASTE_CARD_RENDER_OPTIONS,
    frames,
    delayMs,
    gifWidth,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const timing =
    frames !== undefined && delayMs !== undefined
      ? { frames, delayMs }
      : tasteCardGifTiming(renderOptions.cosmetics?.palette);
  const targetWidth = gifWidth ?? TASTE_CARD_GIF_WIDTH;
  const spec = TASTE_CARD_FORMATS[format];

  const images = await resolveTasteCardImages(
    { avatarDataUrl, brandDataUrl, pickDataUrls },
    renderOptions.showPicks && model.topPicks.length > 0,
    timeoutMs,
  );

  const gifHeight = Math.round((spec.height / spec.width) * targetWidth);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = gifHeight;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new TasteCardRenderError('render', 'Canvas 2D context unavailable.');
    }
    const request = { model, format, copy, images, options: renderOptions };
    const paintFrame = (progress: number): Uint8ClampedArray => {
      paintTasteCardFrame(context, request, targetWidth, gifHeight, progress);
      const rgba = context.getImageData(0, 0, targetWidth, gifHeight).data;
      ditherFrame(rgba, targetWidth, gifHeight);
      return rgba;
    };

    const palette = await sampleGifPalette(request);
    const encoder = GIFEncoder();
    for (let frame = 0; frame < timing.frames; frame += 1) {
      const rgba = paintFrame(frame / timing.frames);
      const index = applyPalette(rgba, palette, 'rgb565');
      encoder.writeFrame(index, targetWidth, gifHeight, {
        palette: frame === 0 ? palette : undefined,
        delay: timing.delayMs,
        repeat: 0,
      });
    }
    encoder.finish();
    return new Blob([new Uint8Array(encoder.bytes())], { type: 'image/gif' });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function sampleGifPalette(request: TasteCardFrameRequest): Promise<number[][]> {
  const spec = TASTE_CARD_FORMATS[request.format];
  const sampleWidth = GIF_PALETTE_SAMPLE_WIDTH;
  const sampleHeight = Math.round((spec.height / spec.width) * sampleWidth);
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new TasteCardRenderError('render', 'Canvas 2D context unavailable.');
    }
    const samples: Uint8ClampedArray[] = [];
    for (let sample = 0; sample < GIF_PALETTE_SAMPLE_COUNT; sample += 1) {
      const progress = sample / GIF_PALETTE_SAMPLE_COUNT;
      paintTasteCardFrame(context, request, sampleWidth, sampleHeight, progress);
      samples.push(context.getImageData(0, 0, sampleWidth, sampleHeight).data);
    }
    const merged = new Uint8Array(sampleWidth * sampleHeight * 4 * samples.length);
    samples.forEach((rgba, index) => merged.set(rgba, index * rgba.length));
    return quantize(merged, 256, { format: 'rgb565' });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export interface TasteCardPreviewPlan {
  readonly width: number;
  readonly height: number;
  readonly loopMs: number;
  paint(progress: number): void;
}

export async function prepareTasteCardPreview(
  canvas: HTMLCanvasElement,
  request: Omit<TasteCardFrameRequest, 'images'>,
  sources: TasteCardAssetSources,
  animated: boolean,
): Promise<TasteCardPreviewPlan> {
  const images = await resolveTasteCardImages(
    sources,
    request.options.showPicks && request.model.topPicks.length > 0,
  );
  const frameRequest: TasteCardFrameRequest = { ...request, images };
  const displayWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const density = window.devicePixelRatio || 1;
  const width = Math.max(
    Math.min(Math.round(displayWidth * density), TASTE_CARD_GIF_WIDTH),
    GIF_PALETTE_SAMPLE_WIDTH,
  );
  const height = Math.round(
    (TASTE_CARD_FORMATS[request.format].height / TASTE_CARD_FORMATS[request.format].width) * width,
  );
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new TasteCardRenderError('render', 'Canvas 2D context unavailable.');
  }
  return {
    width,
    height,
    loopMs: animated ? tasteCardGifLoopMs(request.options.cosmetics?.palette) : 0,
    paint: (progress: number) =>
      paintTasteCardFrame(context, frameRequest, width, height, animated ? progress : undefined),
  };
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
    return 'denied';
  }
}

const decodedImageCache = new Map<string, HTMLImageElement>();

async function decodeImage(
  dataUrl: string | null | undefined,
  timeoutMs: number,
): Promise<CanvasImageSource | null> {
  if (dataUrl === null || dataUrl === undefined || dataUrl.length === 0) return null;
  const cached = decodedImageCache.get(dataUrl);
  if (cached !== undefined) return cached;
  try {
    const image = await withTimeout(
      new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new TasteCardRenderError('asset', 'Image decode failed.'));
        element.src = dataUrl;
      }),
      timeoutMs,
    );
    decodedImageCache.set(dataUrl, image);
    if (decodedImageCache.size > DECODED_IMAGE_CACHE_LIMIT) {
      const stale = decodedImageCache.keys().next();
      if (stale.done !== true) decodedImageCache.delete(stale.value);
    }
    return image;
  } catch {
    return null;
  }
}

function ditherFrame(rgba: Uint8ClampedArray, width: number, height: number): void {
  for (let y = 0; y < height; y += 1) {
    const row = (y & 7) * 8;
    for (let x = 0; x < width; x += 1) {
      const offset = (BAYER_MATRIX[row + (x & 7)] / 64 - 0.5) * TASTE_CARD_GIF_DITHER_STRENGTH;
      const index = (y * width + x) * 4;
      rgba[index] += offset;
      rgba[index + 1] += offset;
      rgba[index + 2] += offset;
    }
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
