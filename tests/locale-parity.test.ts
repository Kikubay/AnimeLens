import { describe, expect, it } from 'vitest';
import en from '../src/locales/en.json';
import fr from '../src/locales/fr.json';
import {
  LANGUAGES,
  getCopy,
  placeholdersIn,
  placeholdersOf,
  rawTemplate,
  type Language,
  type MessageKey,
} from '../src/locales';

const FILES: Readonly<Record<Language, typeof en>> = { en, fr };
/**
 * Every key that must appear in a locale file's `messages` map.
 *
 * `authErrorMessage` is deliberately absent: it is selected by error code, so
 * each locale file carries a separate `authErrors` map, checked by the
 * auth-error test in `i18n.test.ts` instead.
 */
const KEYS = Object.keys(en.messages) as readonly MessageKey[];

/** Message keys whose template placeholders are supplied by a loader transform. */
const TRANSFORMED = new Set<MessageKey>([
  'tasteCardCoverSizeValue',
  'reasonTheme',
  'detectedRichWorldsDetail',
]);

describe('locale file parity', () => {
  it('lists every language the loader knows about', () => {
    expect([...LANGUAGES].sort()).toEqual(Object.keys(FILES).sort());
  });

  it('declares a template for every message key in AppCopy', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
    for (const language of LANGUAGES) {
      const missing = KEYS.filter((key) => !(key in FILES[language].messages));
      expect(missing, `${language} is missing keys`).toEqual([]);
    }
  });

  it('has no template that no longer belongs to the interface', () => {
    const declared = new Set(KEYS);
    for (const language of LANGUAGES) {
      const extra = Object.keys(FILES[language].messages).filter(
        (key) => !declared.has(key as MessageKey),
      );
      expect(extra, `${language} has orphaned templates`).toEqual([]);
    }
  });

  it('uses exactly the placeholders the schema declares, in every language', () => {
    for (const key of KEYS) {
      // A transform renames or computes its argument, so the schema names differ.
      if (TRANSFORMED.has(key)) continue;
      for (const language of LANGUAGES) {
        const used = [...new Set(placeholdersIn(rawTemplate(language, key)))].sort();
        const declared = [...placeholdersOf(key)].sort();
        expect(used, `${language}.${key}`).toEqual(declared);
      }
    }
  });

  it('keeps the two languages structurally identical', () => {
    expect(Object.keys(fr.messages)).toEqual(Object.keys(en.messages));
    expect(Object.keys(fr.authErrors)).toEqual(Object.keys(en.authErrors));
  });

  it('fills every placeholder when a message is rendered', () => {
    for (const key of KEYS) {
      const names = placeholdersOf(key);
      if (names.length === 0) continue;
      for (const language of LANGUAGES) {
        const rendered = callTemplate(language, key);
        // A leftover `{name}` means the template asked for a value nobody passed.
        expect(rendered, `${language}.${key}`).not.toMatch(/\{[a-zA-Z]/);
      }
    }
  });
});

/** Renders a templated message with a distinct marker per placeholder. */
function callTemplate(language: Language, key: MessageKey): string {
  const copy = getCopy(language) as unknown as Record<string, unknown>;
  const fn = copy[key];
  if (typeof fn !== 'function') throw new Error(`${key} is not templated`);
  const args = placeholdersOf(key).map((name) =>
    name === 'count' || name === 'value' || name === 'outOf' || name === 'position'
      ? 1
      : name === 'scale' || name === 'total' || name === 'filled' || name === 'score'
        ? 1
        : `X${name}X`,
  );
  return (fn as (...values: unknown[]) => string)(...args);
}
