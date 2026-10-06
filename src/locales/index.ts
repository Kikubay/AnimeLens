import type { AuthErrorCode } from '../auth/auth-types';
import { LANGUAGES, MESSAGE_PARAMS, placeholdersOf, type AppCopy, type Language } from './schema';
import en from './en.json';
import fr from './fr.json';

export { LANGUAGES, MESSAGE_PARAMS, placeholdersOf };
export type { AppCopy, Language, TemplatedKey } from './schema';

// Typing the imported locale files against this makes a missing or misspelled key a compile error instead of an untranslated string.
export type MessageKey = Exclude<keyof AppCopy, 'authErrorMessage'>;

interface LocaleFile {
  readonly meta: { readonly language: string; readonly richWorldsFallback: string };
  readonly authErrors: Readonly<Record<AuthErrorCode, string>>;
  readonly messages: Readonly<Record<MessageKey, string>>;
}

const FILES: Readonly<Record<Language, LocaleFile>> = { en, fr };

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

export function placeholdersIn(template: string): readonly string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

// French needs "1re", not "1." — feminine because every rank template goes on to say "position".
function ordinal(language: Language, value: unknown): string {
  const rank = Number(value);
  if (!Number.isFinite(rank)) return String(value);
  return language === 'fr' ? (rank === 1 ? '1re' : `${rank}e`) : `#${rank}`;
}

const DELTA_TRANSFORMS = [
  { key: 'profileDeltaEntered', rank: true },
  { key: 'profileDeltaLeft', rank: false },
  { key: 'profileDeltaRankUp', rank: true },
  { key: 'profileDeltaRankDown', rank: true },
  { key: 'profileDeltaScoreUp', rank: false },
  { key: 'profileDeltaScoreDown', rank: false },
] as const satisfies readonly { readonly key: MessageKey; readonly rank: boolean }[];

// Lives here rather than in the JSON so the templates stay plain strings a translator can read without touching code.
const ARGUMENT_TRANSFORMS: Readonly<
  Partial<
    Record<
      MessageKey,
      (args: readonly unknown[], locale: LocaleFile) => Readonly<Record<string, unknown>>
    >
  >
> = {
  // 1.5 has to arrive as "150"; the template owns the space before %.
  tasteCardCoverSizeValue: ([scale]) => ({ percent: Math.round(Number(scale) * 100) }),
  // French slots the theme mid-sentence, where a capital reads wrong.
  reasonTheme: ([name]) => ({ name: String(name).toLowerCase() }),
  // The genre is optional, so the sentence still has to read without it.
  detectedRichWorldsDetail: ([name], locale) => ({ name: name ?? locale.meta.richWorldsFallback }),
  // The axis label is a heading everywhere else, so it has to lose its capital here. Ranks are localized; the rest pass straight through.
  ...Object.fromEntries(
    DELTA_TRANSFORMS.map(({ key, rank }) => [
      key,
      (args: readonly unknown[], locale: LocaleFile) => {
        const values: Record<string, unknown> = bind(placeholdersOf(key), args);
        values.axis = String(args[0] ?? '').toLowerCase();
        if (rank) values.rank = ordinal(normalizeLanguage(locale.meta.language), args[2]);
        return values;
      },
    ]),
  ),
};

// Argument order is fixed by the call site; the template can use the placeholders in whatever order its language needs.
function format(template: string, values: Readonly<Record<string, unknown>>): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

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

export function rawTemplate(language: Language, key: MessageKey): string {
  return FILES[language].messages[key];
}

// Categories are internal slugs and never rendered directly; an unmapped one falls back to the generic label.
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

// Cached and shared, so callers must treat what they get as read-only.
export function getCopy(language: Language): AppCopy {
  return (cache[language] ??= buildCopy(language));
}
