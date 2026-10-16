export type ProfileSignalKey =
  'richWorlds' | 'complexCharacters' | 'discerningTaste' | 'refinedProfile';

export const PROFILE_SIGNAL_KEYS: readonly ProfileSignalKey[] = [
  'richWorlds',
  'complexCharacters',
  'discerningTaste',
  'refinedProfile',
];

export const RICH_WORLDS_MIN_GENRES = 2;
export const DISCERNING_TASTE_MIN_AVERAGE = 8;
export const REFINED_PROFILE_MIN_FEEDBACK = 2;

const STORY_DRIVEN_THEME = /psych|myst|emotion|drama|character|story/i;

export interface ProfileSignalInput {
  readonly favoriteGenres: readonly { readonly name: string }[];
  readonly favoriteThemes: readonly { readonly name: string }[];
  readonly ratedAnimeCount: number;
  readonly averageScore: number | null;
  readonly feedbackCount: number;
}

export interface ProfileSignalState {
  readonly key: ProfileSignalKey;
  readonly unlocked: boolean;
  readonly progress: number;
}

export function evaluateProfileSignals(input: ProfileSignalInput): readonly ProfileSignalState[] {
  return [
    ratioState('richWorlds', input.favoriteGenres.length, RICH_WORLDS_MIN_GENRES),
    {
      key: 'complexCharacters',
      unlocked: input.favoriteThemes.some((item) => STORY_DRIVEN_THEME.test(item.name)),
      progress: input.favoriteThemes.some((item) => STORY_DRIVEN_THEME.test(item.name)) ? 100 : 0,
    },
    {
      key: 'discerningTaste',
      unlocked: isDiscerningTaste(input),
      progress: tasteProgress(input),
    },
    ratioState('refinedProfile', input.feedbackCount, REFINED_PROFILE_MIN_FEEDBACK),
  ];
}

export function isSignalUnlocked(key: ProfileSignalKey, input: ProfileSignalInput): boolean {
  return evaluateProfileSignals(input).find((signal) => signal.key === key)?.unlocked ?? false;
}

function isDiscerningTaste(input: ProfileSignalInput): boolean {
  return (
    input.ratedAnimeCount > 0 &&
    input.averageScore !== null &&
    input.averageScore >= DISCERNING_TASTE_MIN_AVERAGE
  );
}

function tasteProgress(input: ProfileSignalInput): number {
  if (input.ratedAnimeCount <= 0 || input.averageScore === null) return 0;
  return clampPercent((input.averageScore / DISCERNING_TASTE_MIN_AVERAGE) * 100);
}

function ratioState(key: ProfileSignalKey, value: number, target: number): ProfileSignalState {
  return {
    key,
    unlocked: value >= target,
    progress: clampPercent((value / Math.max(1, target)) * 100),
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
