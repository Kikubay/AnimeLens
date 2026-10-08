import type { AuthErrorCode } from '../auth/auth-types';

export type Language = 'fr' | 'en';

export const LANGUAGES: readonly Language[] = ['fr', 'en'];

// Every key here has to exist in each locale JSON with exactly the placeholders declared in MESSAGE_PARAMS, in any order; a missing key is a compile error and the locale-parity tests catch a drifted placeholder. `authErrorMessage` is the exception, since it's keyed by error code and each locale file carries an `authErrors` map for it.
export interface AppCopy {
  readonly languageName: string;
  readonly newLabel: string;
  readonly openDetails: string;
  readonly episodesShort: string;
  readonly recommendationWhy: string;
  readonly recommendationEngine: string;
  readonly hiddenGem: string;
  readonly like: string;
  readonly dislike: string;
  readonly seen: string;
  readonly notNow: string;
  readonly connected: string;
  readonly disconnected: string;
  readonly live: string;
  readonly offline: string;
  readonly discover: string;
  readonly profile: string;
  readonly settings: string;
  readonly openSettings: string;
  readonly updateAvailable: (version: string) => string;
  readonly currentVersion: (version: string) => string;
  readonly update: string;
  readonly dislikeTitle: string;
  readonly dislikeDescription: string;
  readonly dislikeReasons: string;
  readonly dislikeTheme: (name: string) => string;
  readonly dislikeGenre: (name: string) => string;
  readonly dislikeGeneral: string;
  readonly cancel: string;
  readonly send: string;
  readonly savedPreference: string;
  readonly syncUnavailable: string;
  readonly malConnected: string;
  readonly malDisconnected: string;
  readonly authUnavailable: string;
  readonly dashboardEyebrow: string;
  readonly hello: string;
  readonly dashboardIntro: string;
  readonly connectedList: string;
  readonly connectSignals: string;
  readonly connectMal: string;
  readonly authenticating: string;
  readonly finalizingAccount: string;
  readonly authHint: string;
  readonly recommendationsUnavailable: string;
  readonly recommendationsError: string;
  readonly retry: string;
  readonly selectionPreparing: string;
  readonly syncListFirst: string;
  readonly connectToAnalyze: string;
  readonly synchronize: string;
  readonly offlineRecommendations: string;
  readonly todayPick: string;
  readonly recommendationOfTheDay: string;
  readonly analyzed: (count: number) => string;
  readonly curatedSignal: string;
  readonly titles: (count: number) => string;
  readonly noTitles: string;
  readonly previousTitles: (title: string) => string;
  readonly nextTitles: (title: string) => string;
  readonly loadingRecommendations: string;
  readonly analyzingList: string;
  readonly cachedAnime: (count: number) => string;
  readonly listNotSynced: string;
  readonly localData: string;
  readonly lastSync: (date: string) => string;
  readonly readyToImport: string;
  readonly connectToStart: string;
  readonly syncFailed: string;
  readonly syncing: string;
  readonly animeNotFound: string;
  readonly recommendationUnavailable: string;
  readonly backToRecommendations: string;
  readonly categoryTopMatch: string;
  readonly categoryHighlyCompatible: string;
  readonly categoryGenreDiscovery: string;
  readonly categoryBecauseYouLiked: string;
  readonly categoryHiddenGem: string;
  readonly categoryExplore: string;
  readonly categoryContinueWatching: string;
  readonly genres: string;
  readonly themes: string;
  readonly studio: string;
  readonly malScore: string;
  readonly episodes: string;
  readonly year: string;
  readonly whyThisAnime: string;
  readonly compatibility: string;
  readonly greatMatch: string;
  readonly exploreLead: string;
  readonly calculatedScore: string;
  readonly addToList: string;
  readonly adding: string;
  readonly alreadyInList: string;
  readonly openOnMal: string;
  readonly connectToAdd: string;
  readonly viewMal: string;
  readonly profileEyebrow: string;
  readonly animeProfile: string;
  readonly profileIntro: string;
  readonly analyzedAnime: string;
  readonly averageScore: string;
  readonly ratedAnime: string;
  readonly favoriteGenres: string;
  readonly favoriteThemes: string;
  readonly favoriteStudios: string;
  readonly detectedPreferences: string;
  readonly learned: string;
  readonly noSignals: string;
  readonly positiveSignal: string;
  readonly negativeSignal: string;
  readonly lessLikedGenres: string;
  readonly profileDeltaEyebrow: string;
  readonly profileDeltaTitle: string;
  readonly profileDeltaUpdated: string;
  /** Shown instead of the section when there's no baseline to diff against yet. */
  readonly profileDeltaBaseline: string;
  readonly profileDeltaStable: string;
  readonly profileDeltaSince: (date: string) => string;
  readonly profileDeltaEntered: (axis: string, name: string, rank: number) => string;
  readonly profileDeltaLeft: (axis: string, name: string) => string;
  readonly profileDeltaRankUp: (axis: string, name: string, rank: number) => string;
  readonly profileDeltaRankDown: (axis: string, name: string, rank: number) => string;
  readonly profileDeltaScoreUp: (axis: string, name: string, points: number) => string;
  readonly profileDeltaScoreDown: (axis: string, name: string, points: number) => string;
  readonly profileDeltaAverageUp: (from: string, to: string) => string;
  readonly profileDeltaAverageDown: (from: string, to: string) => string;
  readonly profileDeltaClear: string;
  readonly profileDeltaCleared: string;
  readonly profileDeltaUnavailable: string;
  readonly profileCalculated: string;
  readonly refresh: string;
  readonly tasteCardShare: string;
  readonly tasteCardTitle: string;
  readonly tasteCardIntro: string;
  readonly tasteCardPreviewLabel: string;
  readonly tasteCardSubtitle: string;
  readonly tasteCardAnalyzed: string;
  readonly tasteCardAverageScore: string;
  readonly tasteCardRated: string;
  readonly tasteCardTopGenres: string;
  readonly tasteCardTopRated: string;
  readonly tasteCardAffinity: string;
  readonly tasteCardNoGenres: string;
  readonly tasteCardFooter: string;
  /** Fallback for when the provider has no username to print. */
  readonly tasteCardDefaultName: string;
  /** Stays in Latin script in every language. */
  readonly brandWordmark: string;
  readonly betaBadge: string;
  readonly tasteCardFormat: string;
  readonly tasteCardFormatPortrait: string;
  readonly tasteCardFormatSquare: string;
  readonly tasteCardFormatTall: string;
  readonly tasteCardDownload: string;
  readonly tasteCardCopy: string;
  readonly tasteCardGenerating: string;
  readonly tasteCardDownloaded: string;
  readonly tasteCardCopied: string;
  readonly tasteCardCopyFailed: string;
  readonly tasteCardCopyUnsupported: string;
  readonly tasteCardRenderFailed: string;
  readonly topPicksTitle: string;
  readonly topPicksIntroTie: (count: number, score: number) => string;
  readonly topPicksIntroManual: (count: number, score: number) => string;
  readonly topPicksSelectSlot: (position: number) => string;
  readonly topPicksSlotLocked: string;
  readonly topPicksSlotChosen: string;
  readonly topPicksChosenBadge: string;
  readonly topPicksSkipDefault: string;
  readonly topPicksDefaultHint: string;
  readonly topPicksDefaultUsed: string;
  readonly topPicksUpdated: string;
  readonly topPicksResetDone: string;
  readonly topPicksChange: string;
  readonly topPicksLoadFailed: string;
  readonly topPicksSaveFailed: string;
  readonly topPicksNoCandidates: string;
  readonly tasteCardOptionsTitle: string;
  readonly tasteCardShowGenres: string;
  readonly tasteCardShowPicks: string;
  readonly tasteCardCoverSize: string;
  readonly tasteCardPicksLayout: string;
  readonly tasteCardLayoutList: string;
  readonly tasteCardLayoutTriangle: string;
  readonly tasteCardLayoutGrid: string;
  readonly tasteCardGridTitle: string;
  readonly tasteCardGridIntro: (filled: number, total: number) => string;
  readonly tasteCardGridSlot: (position: number) => string;
  readonly tasteCardGridFilled: string;
  readonly tasteCardGridSearch: string;
  readonly tasteCardGridNoMatches: string;
  readonly tasteCardGridDone: string;
  readonly tasteCardGridNotPersisted: string;
  readonly tasteCardGridActive: (slot: string) => string;
  readonly tasteCardGridAllFilled: string;
  readonly tasteCardGridEmptyBox: string;
  readonly tasteCardCoverSizeValue: (scale: number) => string;
  readonly tasteCardCoverSizeCapped: string;
  readonly tasteCardOptionsSaved: string;
  readonly tasteCardAssetFailed: string;
  readonly settingsEyebrow: string;
  readonly settingsTitle: string;
  readonly settingsIntro: string;
  readonly accountSummary: string;
  readonly accountNotConnected: string;
  readonly malSynced: string;
  readonly mode: string;
  readonly personalized: string;
  readonly exploratory: string;
  readonly account: string;
  readonly malStatus: string;
  readonly connectedAs: (username: string) => string;
  readonly noAccount: string;
  readonly connectAccountDescription: string;
  readonly importLatestList: string;
  readonly removeAccount: string;
  readonly disconnect: string;
  readonly oauthConfig: string;
  readonly oauthEyebrow: string;
  readonly exclusionDescription: string;
  readonly malClientId: string;
  readonly sharedFolderDescription: string;
  readonly yourMalClientId: string;
  readonly redirectUri: string;
  readonly oauthInstructions: string;
  readonly saveClientId: string;
  readonly saving: string;
  readonly clientIdSaved: string;
  readonly clientIdReset: string;
  readonly recommendations: string;
  readonly discovery: string;
  readonly hiddenGems: string;
  readonly hiddenGemsDescription: string;
  readonly olderAnime: string;
  readonly olderAnimeDescription: string;
  readonly movies: string;
  readonly moviesDescription: string;
  readonly shortSeries: string;
  readonly shortSeriesDescription: string;
  readonly discoveryStyle: string;
  readonly discoveryStyleDescription: string;
  readonly whereToWatch: string;
  readonly watchOn: (name: string) => string;
  readonly appearance: string;
  readonly interfaceLabel: string;
  readonly notifications: string;
  readonly reminders: string;
  readonly dailyRecommendation: string;
  readonly dailyRecommendationDescription: string;
  readonly data: string;
  readonly localStorage: string;
  readonly clearCache: string;
  readonly clearCacheDescription: string;
  readonly deleteLocalData: string;
  readonly deleteLocalDataDescription: string;
  readonly language: string;
  readonly french: string;
  readonly english: string;
  readonly languageDescription: string;
  readonly settingsUnavailable: string;
  readonly settingsLoadError: string;
  readonly saveError: string;
  readonly actionImpossible: string;
  readonly malAddSuccess: string;
  readonly malListError: string;
  readonly episodeLabel: string;
  readonly profileNoData: string;
  readonly profileHint: string;
  readonly profileRefreshed: string;
  readonly preferenceUpdated: string;
  readonly notificationsEnabled: string;
  readonly notificationsDisabled: string;
  readonly notificationsDescription: string;
  readonly system: string;
  readonly exclusionType: string;
  readonly genre: string;
  readonly theme: string;
  readonly searchExcluded: (kind: string) => string;
  readonly excludedList: (kind: string) => string;
  readonly excluded: (kind: string, value: string) => string;
  readonly restored: (kind: string, value: string) => string;
  readonly restore: string;
  readonly noExcluded: (kind: string) => string;
  readonly clearCacheConfirmation: string;
  readonly deleteDataConfirmationTitle: string;
  readonly deleteDataConfirmationMessage: string;
  readonly deleteDataConfirmationAction: string;
  readonly disconnectConfirmationTitle: string;
  readonly disconnectConfirmationMessage: string;
  readonly disconnectConfirmationAction: string;
  readonly sectionHighlyCompatible: string;
  readonly sectionBecauseYouLiked: string;
  readonly sectionHiddenGems: string;
  readonly sectionExplore: string;
  readonly themeLight: string;
  readonly themeDark: string;
  readonly closeLabel: string;
  readonly dismissNotificationLabel: string;
  readonly ratingAria: (value: number, outOf: number) => string;
  readonly compatibilityAria: (value: number) => string;
  readonly matchCaption: string;
  readonly coverAlt: (title: string) => string;
  readonly languageEyebrow: string;
  readonly malListAuthRequired: string;
  readonly malListSessionExpired: string;
  readonly malListUnavailable: string;
  readonly malListRefused: string;
  readonly dailyNotificationMessage: string;
  readonly dailyNotificationTitle: string;
  readonly backgroundActionFailed: string;
  readonly pinFlowAniListOnly: string;
  readonly unknownProvider: string;
  readonly unknownSettingsAction: string;
  readonly syncProgressFetching: string;
  readonly syncProgressFetchingCount: (count: number) => string;
  readonly syncProgressFetched: (count: number) => string;
  readonly syncProgressGenres: string;
  readonly syncProgressPreferences: string;
  readonly syncProgressComplete: string;
  readonly syncCacheHit: string;
  readonly syncOfflineFallback: string;
  readonly syncStorageFull: string;
  readonly syncErrorMessage: string;
  readonly reasonGenre: (name: string) => string;
  readonly reasonTheme: (name: string) => string;
  readonly reasonStudio: (studio: string) => string;
  readonly reasonStaff: string;
  readonly reasonRating: string;
  readonly reasonSafePick: string;
  readonly reasonProfileFit: string;
  readonly detectedRichWorlds: string;
  readonly detectedRichWorldsDetail: (name: string | null) => string;
  readonly detectedComplexCharacters: string;
  readonly detectedComplexCharactersDetail: string;
  readonly detectedDiscerningTaste: string;
  readonly detectedDiscerningTasteDetail: (average: string) => string;
  readonly detectedRefinedProfile: string;
  readonly detectedRefinedProfileDetail: (count: number) => string;
  readonly providers: string;
  readonly providersEyebrow: string;
  readonly providersIntro: string;
  readonly providerActive: string;
  readonly providerMakeActive: string;
  readonly providerConnect: string;
  readonly providerDisconnect: string;
  readonly providerAnilistClientId: string;
  readonly yourAnilistClientId: string;
  readonly anilistRedirectUriLabel: string;
  readonly anilistOauthInstructions: string;
  readonly anilistClientIdSaved: string;
  readonly anilistClientIdReset: string;
  readonly providerConnectedToast: (name: string) => string;
  readonly providerDisconnectedToast: (name: string) => string;
  readonly providerActiveToast: (name: string) => string;
  readonly openOnAnilist: string;
  readonly viewAnilist: string;
  readonly pinInstructions: string;
  readonly pinDetected: string;
  readonly pinPastePrompt: string;
  readonly pinTokenLabel: string;
  readonly pinTokenPlaceholder: string;
  readonly pinSubmit: string;
  readonly providerSynced: (name: string) => string;
  readonly providerListConnected: (name: string) => string;
  readonly providerConnectSignals: (name: string) => string;
  readonly providerConnectAction: (name: string) => string;
  readonly providerAuthenticating: (name: string) => string;
  readonly providerSyncListFirst: (name: string) => string;
  readonly providerConnectToAnalyze: (name: string) => string;
  readonly providerListNotSynced: (name: string) => string;
  readonly providerConnectToStart: (name: string) => string;
  readonly providerAddSuccess: (name: string) => string;
  readonly providerListError: (name: string) => string;
  readonly providerConnectToAdd: (name: string) => string;
  readonly providerScore: (name: string) => string;
  readonly listAuthRequired: (name: string) => string;
  readonly listSessionExpired: (name: string) => string;
  readonly listUnavailable: (name: string) => string;
  readonly listRefused: (name: string) => string;
  readonly searchFieldLabel: string;
  readonly searchPlaceholder: string;
  readonly searchClear: string;
  readonly searchMinChars: (count: number) => string;
  readonly searchEyebrow: string;
  readonly searchResultsTitle: string;
  readonly searching: string;
  readonly searchNoResults: (query: string) => string;
  readonly searchFailed: string;
  readonly searchAuthRequired: (name: string) => string;
  readonly searchSessionExpired: (name: string) => string;
  readonly searchUnavailable: (name: string) => string;
  readonly authErrorMessage: (code: AuthErrorCode | null, fallback: string) => string;
}

// Argument order mirrors each `AppCopy` member's parameter list, which is how the loader binds them — that's what lets a translation repeat or reorder its placeholders. Plain-string members are the ones absent from here, and `AssertCoverage` below fails to compile if a templated key is ever added without an entry.
const MESSAGE_PARAMS = {
  updateAvailable: ['version'],
  currentVersion: ['version'],
  dislikeTheme: ['name'],
  dislikeGenre: ['name'],
  analyzed: ['count'],
  titles: ['count'],
  previousTitles: ['title'],
  nextTitles: ['title'],
  cachedAnime: ['count'],
  lastSync: ['date'],
  topPicksIntroTie: ['count', 'score'],
  topPicksIntroManual: ['count', 'score'],
  topPicksSelectSlot: ['position'],

  tasteCardGridIntro: ['filled', 'total'],
  tasteCardGridSlot: ['position'],
  tasteCardGridActive: ['slot'],
  tasteCardCoverSizeValue: ['scale'],
  connectedAs: ['username'],
  searchExcluded: ['kind'],
  excludedList: ['kind'],
  excluded: ['kind', 'value'],
  restored: ['kind', 'value'],
  noExcluded: ['kind'],
  ratingAria: ['value', 'outOf'],
  compatibilityAria: ['value'],
  coverAlt: ['title'],
  syncProgressFetchingCount: ['count'],
  syncProgressFetched: ['count'],
  reasonGenre: ['name'],
  reasonTheme: ['name'],
  reasonStudio: ['studio'],
  detectedRichWorldsDetail: ['name'],
  detectedDiscerningTasteDetail: ['average'],
  detectedRefinedProfileDetail: ['count'],
  profileDeltaSince: ['date'],
  profileDeltaEntered: ['axis', 'name', 'rank'],
  profileDeltaLeft: ['axis', 'name'],
  profileDeltaRankUp: ['axis', 'name', 'rank'],
  profileDeltaRankDown: ['axis', 'name', 'rank'],
  profileDeltaScoreUp: ['axis', 'name', 'points'],
  profileDeltaScoreDown: ['axis', 'name', 'points'],
  profileDeltaAverageUp: ['from', 'to'],
  profileDeltaAverageDown: ['from', 'to'],
  providerConnectedToast: ['name'],
  providerDisconnectedToast: ['name'],
  providerActiveToast: ['name'],
  providerSynced: ['name'],
  providerListConnected: ['name'],
  providerConnectSignals: ['name'],
  providerConnectAction: ['name'],
  providerAuthenticating: ['name'],
  providerSyncListFirst: ['name'],
  providerConnectToAnalyze: ['name'],
  providerListNotSynced: ['name'],
  providerConnectToStart: ['name'],
  providerAddSuccess: ['name'],
  providerListError: ['name'],
  providerConnectToAdd: ['name'],
  providerScore: ['name'],
  watchOn: ['name'],
  listAuthRequired: ['name'],
  listSessionExpired: ['name'],
  listUnavailable: ['name'],
  listRefused: ['name'],
  searchMinChars: ['count'],
  searchNoResults: ['query'],
  searchAuthRequired: ['name'],
  searchSessionExpired: ['name'],
  searchUnavailable: ['name'],
} as const satisfies Readonly<
  Partial<Record<Exclude<keyof AppCopy, 'authErrorMessage'>, readonly string[]>>
>;

/** A templated key is one whose `AppCopy` member takes arguments. */
type TemplatedKey = {
  [K in keyof AppCopy]: K extends 'authErrorMessage'
    ? never
    : AppCopy[K] extends string
      ? never
      : K;
}[keyof AppCopy];

type UndeclaredTemplatedKey = Exclude<TemplatedKey, keyof typeof MESSAGE_PARAMS>;

type AssertCoverage = [UndeclaredTemplatedKey] extends [never]
  ? true
  : ['MESSAGE_PARAMS is missing an entry for', UndeclaredTemplatedKey];

const _coverage: AssertCoverage = true;
void _coverage;

export { MESSAGE_PARAMS };
export type { TemplatedKey };

export function placeholdersOf(key: keyof AppCopy): readonly string[] {
  return (MESSAGE_PARAMS as Readonly<Record<string, readonly string[]>>)[key] ?? EMPTY;
}

const EMPTY: readonly string[] = [];
