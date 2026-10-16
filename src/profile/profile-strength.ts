import { getCopy, type AppCopy, type Language } from '../locales';
import {
  evaluateProfileSignals,
  type ProfileSignalKey,
  type ProfileSignalState,
} from './profile-signals';
import type { UserProfileSummary } from './profile-types';

type StringCopyKey = {
  [K in keyof AppCopy]: AppCopy[K] extends string ? K : never;
}[keyof AppCopy];

const LABEL_KEYS = {
  richWorlds: 'profileStrengthLabelGenres',
  complexCharacters: 'profileStrengthLabelStories',
  discerningTaste: 'profileStrengthLabelAverage',
  refinedProfile: 'profileStrengthLabelFeedback',
} as const satisfies Readonly<Record<ProfileSignalKey, StringCopyKey>>;

const REQUIREMENT_KEYS = {
  richWorlds: 'profileStrengthNeedGenres',
  complexCharacters: 'profileStrengthNeedStory',
  discerningTaste: 'profileStrengthNeedAverage',
  refinedProfile: 'profileStrengthNeedFeedback',
} as const satisfies Readonly<Record<ProfileSignalKey, StringCopyKey>>;

export interface ProfileStrengthSignal extends ProfileSignalState {
  readonly label: string;
  readonly requirement: string;
}

export interface ProfileStrength {
  readonly unlocked: number;
  readonly total: number;
  readonly strength: number;
  readonly signals: readonly ProfileStrengthSignal[];
  readonly nextSignal: ProfileStrengthSignal | null;
}

export function computeProfileStrength(
  summary: UserProfileSummary,
  language: Language = 'en',
): ProfileStrength {
  const copy = getCopy(language);
  const signals = evaluateProfileSignals({
    favoriteGenres: summary.favoriteGenres,
    favoriteThemes: summary.favoriteThemes,
    ratedAnimeCount: summary.ratedAnimeCount,
    averageScore: summary.averageScore,
    feedbackCount: summary.feedbackCount,
  }).map((signal) => ({
    ...signal,
    label: copy[LABEL_KEYS[signal.key]],
    requirement: copy[REQUIREMENT_KEYS[signal.key]],
  }));

  const unlocked = signals.filter((signal) => signal.unlocked).length;
  const pending = signals.filter((signal) => !signal.unlocked);
  let nextSignal: ProfileStrengthSignal | null = null;
  for (const signal of pending) {
    if (nextSignal === null || signal.progress > nextSignal.progress) nextSignal = signal;
  }

  return {
    unlocked,
    total: signals.length,
    strength: Math.round((unlocked / Math.max(1, signals.length)) * 100),
    signals,
    nextSignal,
  };
}
