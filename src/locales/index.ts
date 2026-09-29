import type { AuthErrorCode } from '../auth/auth-types';
import { LANGUAGES, MESSAGE_PARAMS, placeholdersOf, type AppCopy, type Language } from './schema';
import en from './en.json';
import fr from './fr.json';

export { LANGUAGES, MESSAGE_PARAMS, placeholdersOf };
export type { AppCopy, Language, TemplatedKey } from './schema';

/**
 * Every message key, derived from the `AppCopy` interface. Typing the imported
 * files against this turns a missing or misspelled key in a locale into a
 * compile error rather than an untranslated string at runtime.
 */
export type MessageKey = Exclude<keyof AppCopy, 'authErrorMessage'>;

interface LocaleFile {
  readonly meta: { readonly language: string; readonly richWorldsFallback: string };
  readonly authErrors: Readonly<Record<AuthErrorCode, string>>;
  readonly messages: Readonly<Record<MessageKey, string>>;
}

const FILES: Readonly<Record<Language, LocaleFile>> = { en, fr };

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

/** Placeholder names used by a template, in order of first appearance. */
export function placeholdersIn(template: string): readonly string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

/**
 * Messages whose rendered value is not a direct substitution of the arguments.
 * Each transforms its inputs first so the templates in the JSON files stay
 * plain strings a translator can read without touching code.
 */
const ARGUMENT_TRANSFORMS: Readonly<
  Partial<
    Record<
      MessageKey,
      (args: readonly unknown[], locale: LocaleFile) => Readonly<Record<string, unknown>>
    >
  >
> = {
  // Renders 1.5 as "150 %"; the template owns its own spacing.
  tasteCardCoverSizeValue: ([scale]) => ({ percent: Math.round(Number(scale) * 100) }),
  // French needs a lowercase theme name because it inserts one mid-sentence.
  reasonTheme: ([name]) => ({ name: String(name).toLowerCase() }),
  // The leading genre is optional, so the sentence has to read without it.
  detectedRichWorldsDetail: ([name], locale) => ({ name: name ?? locale.meta.richWorldsFallback }),
};

/**
 * Placeholder order is fixed by the call site, but a template is free to use the
 * placeholders in whatever order its language requires.
 */
function format(template: string, values: Readonly<Record<string, unknown>>): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Zips positional arguments onto the placeholder names the schema declared. */
function bind(argNames: readonly string[], args: readonly unknown[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [index, name] of argNames.entries()) values[name] = args[index];
  return values;
}

function buildCopy(language: Language): AppCopy {
  const file = FILES[language];
  const copy: Record<string, unknown> = {};

  for (const [key, template] of Object.entries(file.messages) as [MessageKey, string][]) {
    const argNames = placeholdersOf(key);
    if (argNames.length === 0) {
      copy[key] = template;
      continue;
    }
    const transform = ARGUMENT_TRANSFORMS[key];
    copy[key] = (...args: unknown[]) =>
      format(template, transform ? transform(args, file) : bind(argNames, args));
  }

  copy.authErrorMessage = (code: AuthErrorCode | null, fallback: string) =>
    code === null ? fallback : (file.authErrors[code] ?? fallback);

  return copy as unknown as AppCopy;
}

/** Raw template text for a key, for parity tests and tooling. */
export function rawTemplate(language: Language, key: MessageKey): string {
  return FILES[language].messages[key];
}

/**
 * Human label for a recommendation category. Categories are internal slugs, so
 * they are never rendered directly; an unmapped category falls back to the
 * generic recommendations label.
 */
export function categoryLabel(copy: AppCopy, category: string): string {
  const key = CATEGORY_KEYS[category];
  return key === undefined ? copy.recommendations : copy[key];
}

const CATEGORY_KEYS: Readonly<Record<string, CategoryMessageKey>> = {
  'top-match': 'categoryTopMatch',
  'highly-compatible': 'categoryHighlyCompatible',
  'because-you-liked': 'categoryBecauseYouLiked',
  'genre-discovery': 'categoryGenreDiscovery',
  'hidden-gem': 'categoryHiddenGem',
  explore: 'categoryExplore',
  'continue-watching': 'categoryContinueWatching',
};

type CategoryMessageKey =
  | 'categoryTopMatch'
  | 'categoryHighlyCompatible'
  | 'categoryBecauseYouLiked'
  | 'categoryGenreDiscovery'
  | 'categoryHiddenGem'
  | 'categoryExplore'
  | 'categoryContinueWatching';

export function normalizeLanguage(value: unknown): Language {
  return value === 'fr' || (typeof value === 'string' && value.toLocaleLowerCase().startsWith('fr'))
    ? 'fr'
    : 'en';
}

export function detectBrowserLanguage(): Language {
  return normalizeLanguage(typeof navigator === 'undefined' ? undefined : navigator.language);
}

const cache: Partial<Record<Language, AppCopy>> = {};

/** Copies are cached and shared, so callers must treat them as read-only. */
export function getCopy(language: Language): AppCopy {
  return (cache[language] ??= buildCopy(language));
}
