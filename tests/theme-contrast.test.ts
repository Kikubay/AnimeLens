import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  fileURLToPath(new URL('../src/popup/styles.css', import.meta.url)),
  'utf8',
);

type Theme = Record<string, string>;

interface ThemeBlock {
  readonly selector: string;
  readonly body: string;
  readonly tokens: Theme;
}

function readBlock(selector: string): ThemeBlock {
  const start = stylesheet.indexOf(selector);
  expect(start, `missing ${selector} block`).toBeGreaterThan(-1);
  const body = stylesheet.slice(stylesheet.indexOf('{', start) + 1, stylesheet.indexOf('}', start));
  const tokens: Theme = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return { selector, body, tokens };
}

const darkBlock = readBlock(':root {');
const lightBlock = readBlock(":root[data-theme='light'] {");

const themes: readonly ThemeBlock[] = [darkBlock, lightBlock];

function channels(hex: string): [number, number, number] {
  const value = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const packed = parseInt(value.slice(1), 16);
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const MINIMUM_BODY_TEXT_RATIO = 4.5;

// The pairs the light theme used to fail: dark-only backgrounds left behind while `--text` inverted to
// near-black, which rendered toasts, tooltips, dropdowns and hovered buttons as invisible dark-on-dark.
const PAIRS: readonly (readonly [string, string, string])[] = [
  ['toast', '--overlay', '--text'],
  ['tooltip', '--overlay', '--text'],
  ['dropdown option', '--option-hover', '--text'],
  ['secondary button hover', '--raised-hover', '--text'],
  ['badge', '--chip-bg', '--muted'],
  ['featured recommendation', '--featured-bg', '--text'],
  ['setting icon', '--well-bg', '--muted'],
  ['dim text', '--bg', '--dim'],
  ['danger text', '--bg', '--danger'],
  ['warning text', '--surface', '--warning'],
  ['brand badge', '--bg', '--brand'],
  ['featured description', '--featured-bg', '--text-secondary'],
  ['primary button label', '--accent', '--on-accent'],
  ['primary button hover label', '--accent-hover', '--on-accent'],
];

describe('theme tokens', () => {
  it('mirrors every dark token in the light theme', () => {
    expect(Object.keys(lightBlock.tokens).sort()).toEqual(Object.keys(darkBlock.tokens).sort());
  });

  it.each(themes.map((block) => [block.selector, block] as const))(
    'declares each token once in %s',
    (_selector, block) => {
      const declared = [...block.body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]);
      expect(declared.length).toBeGreaterThan(0);
      expect(declared).toEqual([...new Set(declared)]);
    },
  );
});

describe('theme contrast', () => {
  it.each(themes.map((block) => [block.selector, block] as const))(
    'every body-text pair clears WCAG AA in %s',
    (_selector, block) => {
      const failures: string[] = [];
      for (const [label, background, foreground] of PAIRS) {
        const bg = block.tokens[background];
        const fg = block.tokens[foreground];
        if (bg === undefined || fg === undefined) {
          failures.push(`${label}: ${background} / ${foreground} is not a token`);
          continue;
        }
        const ratio = contrastRatio(fg, bg);
        if (ratio < MINIMUM_BODY_TEXT_RATIO) {
          failures.push(`${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it.each(themes.map((block) => [block.selector, block] as const))(
    'keeps the unfilled progress and score tracks distinguishable in %s',
    (_selector, block) => {
      const track = block.tokens['--track'];
      const raised = block.tokens['--surface-raised'];
      expect(track).toBeDefined();
      expect(raised).toBeDefined();
      expect(contrastRatio(track as string, raised as string)).toBeGreaterThan(1.05);
    },
  );
});
