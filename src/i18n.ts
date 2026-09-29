import type { AuthErrorCode } from './auth/auth-types';

export type Language = 'fr' | 'en';

/** Localized text for each known auth error code; 'unknown' falls back to the raw message. */
const frenchAuthErrors: Partial<Record<AuthErrorCode, string>> = {
  configuration:
    'AnimeLens n’est pas configuré pour se connecter à ce fournisseur. Vérifiez le Client ID dans les réglages.',
  cancelled: 'L’authentification a été annulée.',
  invalid_callback: 'La connexion avec MyAnimeList a échoué.',
  state_mismatch: 'Impossible de vérifier la demande de connexion.',
  token_exchange:
    'L’échange du code d’autorisation a échoué. Vérifiez l’URL de redirection et le Client ID.',
  profile_fetch: 'Impossible de récupérer votre profil MAL.',
  token_expired: 'Votre session MAL a expiré.',
  network_error: 'Problème de réseau. Vérifiez votre connexion.',
  session_expired: 'Votre session MAL a expiré. Reconnectez votre compte.',
  invalid_redirect_uri: 'L’URL de redirection n’est pas enregistrée dans MyAnimeList.',
  mal_configuration: 'La configuration du fournisseur est incorrecte. Vérifiez le Client ID.',
};

const englishAuthErrors: Partial<Record<AuthErrorCode, string>> = {
  configuration:
    'AnimeLens is not configured to connect to this provider. Check the Client ID in Settings.',
  cancelled: 'Authentication was cancelled.',
  invalid_callback: 'The MyAnimeList sign-in handoff failed.',
  state_mismatch: 'The sign-in request could not be verified.',
  token_exchange: 'The authorization code exchange failed. Check the redirect URL and Client ID.',
  profile_fetch: 'Unable to fetch your MAL profile.',
  token_expired: 'Your MAL session has expired.',
  network_error: 'A network problem occurred. Check your connection.',
  session_expired: 'Your MAL session has expired. Reconnect your account.',
  invalid_redirect_uri: 'The redirect URL is not registered with MyAnimeList.',
  mal_configuration: 'The provider configuration is incorrect. Check the Client ID.',
};

function authMessage(
  texts: Partial<Record<AuthErrorCode, string>>,
): (code: AuthErrorCode | null, fallback: string) => string {
  return (code, fallback) => (code !== null ? (texts[code] ?? fallback) : fallback);
}

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
  readonly authErrorMessage: (code: AuthErrorCode | null, fallback: string) => string;
  readonly malListAuthRequired: string;
  readonly malListSessionExpired: string;
  readonly malListUnavailable: string;
  readonly malListRefused: string;
  readonly dailyNotificationMessage: string;
  readonly backgroundActionFailed: string;
  readonly syncProgressFetching: string;
  readonly syncProgressFetchingCount: (count: number) => string;
  readonly syncProgressFetched: (count: number) => string;
  readonly syncProgressGenres: string;
  readonly syncProgressPreferences: string;
  readonly syncProgressComplete: string;
  readonly syncCacheHit: string;
  readonly syncOfflineFallback: string;
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
}

const french: AppCopy = {
  languageName: 'Français',
  newLabel: 'NOUVEAU',
  openDetails: 'Voir les détails',
  episodesShort: 'épisodes',
  recommendationWhy: 'Pourquoi cette recommandation',
  recommendationEngine: 'Moteur de recommandation',
  hiddenGem: 'PÉPITE',
  like: 'J’aime',
  dislike: 'Pas pour moi',
  seen: 'Déjà vu',
  notNow: 'Pas maintenant',
  connected: 'Connecté',
  disconnected: 'Déconnecté',
  discover: 'Découvrir',
  profile: 'Profil',
  settings: 'Réglages',
  live: 'En ligne',
  offline: 'Hors ligne',
  openSettings: 'Ouvrir les réglages',
  updateAvailable: (version) => `Nouvelle version disponible · v${version}`,
  currentVersion: (version) => `Votre version : v${version}`,
  update: 'Mettre à jour',
  dislikeTitle: 'Pourquoi n’avez-vous pas aimé cet anime ?',
  dislikeDescription:
    'Vos réponses nous aident à ajuster les prochaines recommandations. Vous pouvez sélectionner plusieurs raisons.',
  dislikeReasons: 'Raisons du désaccord',
  dislikeTheme: (name) => `Je n’aime pas le thème ${name}.`,
  dislikeGenre: (name) => `Je n’aime pas le genre ${name}.`,
  dislikeGeneral: 'Je n’aime simplement pas cet anime.',
  cancel: 'Annuler',
  send: 'Envoyer',
  savedPreference: 'Préférence enregistrée',
  syncUnavailable: 'Synchronisation indisponible',
  malConnected: 'Compte MAL connecté',
  malDisconnected: 'Compte MAL déconnecté',
  authUnavailable: 'Service d’authentification indisponible.',
  dashboardEyebrow: 'ANIMELENS DISCOVERY',
  hello: 'Bonjour',
  dashboardIntro: 'Voici les anime que nous avons sélectionnés pour vous.',
  connectedList: 'liste MAL connectée',
  connectSignals: 'Connectez MAL pour personnaliser vos signaux.',
  connectMal: 'Connecter MAL',
  authenticating: 'Authentification MAL…',
  finalizingAccount: 'Finalisation du compte…',
  authHint:
    'Ce message est souvent lié à l’URL de redirection ou au Client ID, pas à la connexion internet.',
  recommendationsUnavailable: 'Recommandations indisponibles',
  recommendationsError: 'Impossible de calculer vos recommandations.',
  retry: 'Réessayer',
  selectionPreparing: 'Votre sélection se prépare',
  syncListFirst:
    'Synchronisez une liste MAL contenant quelques anime pour recevoir vos premières recommandations.',
  connectToAnalyze: 'Connectez votre compte MAL pour qu’AnimeLens puisse analyser vos goûts.',
  synchronize: 'Synchroniser',
  offlineRecommendations: 'Hors ligne · recommandations calculées depuis vos données locales',
  todayPick: 'SÉLECTION DU JOUR',
  recommendationOfTheDay: 'Recommandation du jour',
  analyzed: (count) => `${count} analysés`,
  curatedSignal: 'SÉLECTION SOIGNEUSE',
  titles: (count) => `${count} titres`,
  noTitles: 'Aucun titre dans cette catégorie pour le moment.',
  previousTitles: (title) => `Titres précédents dans ${title}`,
  nextTitles: (title) => `Titres suivants dans ${title}`,
  loadingRecommendations: 'Chargement des recommandations',
  analyzingList: 'Analyse de votre liste…',
  cachedAnime: (count) => `${count} anime en cache`,
  listNotSynced: 'Liste MAL non synchronisée',
  localData: 'Hors ligne · données locales',
  lastSync: (date) => `Dernière sync : ${date}`,
  readyToImport: 'Prêt à importer votre liste',
  connectToStart: 'Connectez MAL pour commencer',
  syncFailed: 'Échec de la sync',
  syncing: 'En cours…',
  animeNotFound: 'Anime introuvable',
  recommendationUnavailable: 'Cette recommandation n’est plus disponible dans vos données locales.',
  backToRecommendations: 'Retour aux recommandations',
  genres: 'Genres',
  themes: 'Thèmes',
  studio: 'Studio',
  malScore: 'Score MAL',
  episodes: 'Épisodes',
  year: 'Année',
  whyThisAnime: 'Pourquoi cet anime vous est proposé',
  compatibility: 'COMPATIBILITÉ',
  greatMatch: 'Très bon match',
  exploreLead: 'Une piste à explorer',
  calculatedScore: 'Score calculé par le moteur AnimeLens.',
  addToList: 'Ajouter à ma liste',
  adding: 'Ajout…',
  alreadyInList: 'Déjà dans ma liste',
  openOnMal: 'Ouvrir sur MAL',
  connectToAdd: 'Connectez MAL pour ajouter cet anime directement à votre liste.',
  viewMal: 'Voir la fiche complète sur MyAnimeList ↗',
  profileEyebrow: 'VOTRE PROFIL ANIME',
  animeProfile: 'Votre profil anime',
  profileIntro: 'Ce qu’AnimeLens a appris de vos anime et de vos retours.',
  analyzedAnime: 'anime analysés',
  averageScore: 'Score moyen',
  ratedAnime: 'Anime notés',
  favoriteGenres: 'Genres favoris',
  favoriteThemes: 'Thèmes favoris',
  favoriteStudios: 'Studios favoris',
  detectedPreferences: 'Préférences détectées',
  learned: 'Appris',
  noSignals: 'Pas encore de signal suffisamment régulier.',
  positiveSignal: 'SIGNAL POSITIF',
  negativeSignal: 'SIGNAL NÉGATIF',
  lessLikedGenres: 'Genres moins appréciés',
  profileCalculated: 'Profil calculé à partir de vos données locales.',
  refresh: 'Actualiser',
  tasteCardShare: 'Partager ma carte de goûts',
  tasteCardTitle: 'Votre carte de goûts',
  tasteCardIntro:
    'Téléchargez ou copiez une image de votre profil à partager sur Discord, X, Reddit…',
  tasteCardPreviewLabel: 'Aperçu de la carte de goûts',
  tasteCardSubtitle: 'Profil de goûts anime',
  tasteCardAnalyzed: 'Dans la liste',
  tasteCardAverageScore: 'Score moyen',
  tasteCardRated: 'Notés',
  tasteCardTopGenres: 'Genres favoris',
  tasteCardTopRated: 'Les mieux notés',
  tasteCardAffinity: '% d’affinité',
  tasteCardNoGenres: 'Pas encore assez de données.',
  tasteCardFooter: 'Réalisé avec AnimeLens',
  tasteCardFormat: 'Format de la carte',
  tasteCardFormatPortrait: 'Portrait 4:5',
  tasteCardFormatSquare: 'Carré 1:1',
  tasteCardFormatTall: 'Vertical 3:4',
  tasteCardDownload: 'Télécharger le PNG',
  tasteCardCopy: 'Copier l’image',
  tasteCardGenerating: 'Génération…',
  tasteCardDownloaded: 'Carte de goûts téléchargée.',
  tasteCardCopied: 'Carte de goûts copiée dans le presse-papiers.',
  tasteCardCopyFailed: 'Presse-papiers indisponible — l’image a été téléchargée à la place.',
  tasteCardCopyUnsupported: 'Copie d’images non prise en charge ici — utilisez le téléchargement.',
  tasteCardRenderFailed: 'Impossible de générer la carte de goûts. Réessayez.',
  topPicksTitle: 'Choisissez votre Top 3',
  topPicksIntroTie: (count, score) =>
    `${count} anime sont à égalité à ${score}/10. Choisissez celui qui occupe la dernière place.`,
  topPicksIntroManual: (count, score) =>
    `${count} anime sont à égalité à ${score}/10. Revenez sur votre choix.`,
  topPicksSelectSlot: (position) => `Choisissez votre anime n°${position}`,
  topPicksSlotLocked: 'Rempli automatiquement',
  topPicksSlotChosen: 'Votre choix',
  topPicksChosenBadge: 'Choisi',
  topPicksSkipDefault: 'Ignorer et utiliser l’ordre par défaut',
  topPicksDefaultHint: 'Par défaut, le plus récemment mis à jour est retenu.',
  topPicksDefaultUsed: 'Utilisation de l anime le plus récemment mis à jour.',
  topPicksUpdated: 'Top 3 mis à jour.',
  topPicksResetDone: 'Classement réinitialisé. Choisissez à nouveau.',
  topPicksChange: 'Modifier mes choix',
  topPicksLoadFailed: 'Impossible de charger vos choix du Top 3.',
  topPicksSaveFailed: 'Impossible d’enregistrer votre Top 3.',
  topPicksNoCandidates: 'Aucun candidat disponible.',
  tasteCardOptionsTitle: 'Contenu de la carte',
  tasteCardShowGenres: 'Afficher les genres favoris',
  tasteCardShowPicks: 'Afficher les mieux notés',
  tasteCardCoverSize: 'Taille des couvertures',
  tasteCardPicksLayout: 'Disposition des mieux notés',
  tasteCardLayoutList: 'Liste',
  tasteCardLayoutTriangle: 'Triangle',
  tasteCardLayoutGrid: 'Grille 3×3',
  tasteCardGridTitle: 'Composez votre grille 3×3',
  tasteCardGridIntro: (filled, total) =>
    `Choisissez ${total} anime pour votre grille — ${filled} sur ${total} sélectionnés. Rien n’est enregistré.`,
  tasteCardGridSlot: (position) => `Case ${position}`,
  tasteCardGridFilled: 'Remplie',
  tasteCardGridActive: (slot) => `Case ${slot} sélectionnée — choisissez un anime ci-dessous.`,
  tasteCardGridAllFilled: 'Les neuf cases sont remplies.',
  tasteCardGridEmptyBox: 'Vider',
  tasteCardGridSearch: 'Rechercher vos anime notés',
  tasteCardGridNoMatches: 'Aucun anime ne correspond à votre recherche.',
  tasteCardGridDone: 'Grille prête',
  tasteCardGridNotPersisted: 'Votre grille n’est pas enregistrée — à refaire la prochaine fois.',
  tasteCardCoverSizeValue: (scale) => ` ${Math.round(scale * 100)} % `,
  tasteCardCoverSizeCapped: 'Plus grand en masquant une section.',
  tasteCardOptionsSaved: 'Préférences de la carte enregistrées.',
  tasteCardAssetFailed: 'La carte n’a pas pu charger votre avatar. Réessayez ou déconnectez-vous.',
  settingsEyebrow: 'PERSONNALISATION',
  settingsTitle: 'Réglages',
  settingsIntro: 'Une expérience qui s’adapte à votre façon de découvrir.',
  accountSummary: 'Résumé de votre compte et de vos préférences',
  accountNotConnected: 'Compte non connecté',
  malSynced: 'MAL synchronisé',
  mode: 'Mode',
  personalized: 'Personnalisé',
  exploratory: 'Exploratoire',
  account: 'Compte',
  malStatus: 'Statut MAL',
  connectedAs: (username) => `Connecté en tant que ${username}`,
  noAccount: 'Aucun compte connecté',
  connectAccountDescription: 'Associer votre compte pour personnaliser les recommandations',
  importLatestList: 'Importer la dernière version de votre liste',
  removeAccount: 'Retirer le compte MAL de cette extension',
  disconnect: 'Déconnecter',
  oauthConfig: 'Configuration',
  malClientId: 'Client ID MAL',
  sharedFolderDescription:
    'Utilisez votre propre application MAL si cette extension a été chargée depuis un dossier partagé.',
  yourMalClientId: 'Votre Client ID MAL',
  redirectUri: 'URL de redirection à enregistrer dans MAL',
  oauthInstructions:
    'Créez une application OAuth sur MyAnimeList, ajoutez cette URL exactement, puis enregistrez le Client ID. Le Client Secret n’est pas nécessaire.',
  saveClientId: 'Enregistrer le Client ID',
  saving: 'Enregistrement…',
  clientIdSaved: 'Client ID MAL enregistré',
  clientIdReset: 'Client ID MAL réinitialisé',
  recommendations: 'Recommandations',
  discovery: 'DÉCOUVERTE',
  hiddenGems: 'Pépites',
  hiddenGemsDescription: 'Découvrir des anime moins populaires',
  olderAnime: 'Anime anciens',
  olderAnimeDescription: 'Inclure les titres sortis avant 2010',
  movies: 'Films',
  moviesDescription: 'Inclure les longs métrages',
  shortSeries: 'Séries courtes',
  shortSeriesDescription: 'Favoriser les séries de 13 épisodes ou moins',
  discoveryStyle: 'Style de découverte',
  discoveryStyleDescription: 'Choisissez l’équilibre entre affinité et surprise.',
  appearance: 'Apparence',
  interfaceLabel: 'INTERFACE',
  notifications: 'Notifications',
  reminders: 'RAPPELS',
  dailyRecommendation: 'Recommandation quotidienne',
  dailyRecommendationDescription: 'Recevoir une suggestion chaque jour',
  data: 'Données',
  localStorage: 'STOCKAGE LOCAL',
  clearCache: 'Vider le cache',
  clearCacheDescription: 'Supprimer la liste synchronisée, conserver vos réglages',
  deleteLocalData: 'Supprimer les données locales',
  deleteLocalDataDescription: 'Effacer liste, feedbacks, profil et réglages',
  language: 'Langue',
  french: 'Français',
  english: 'English',
  languageDescription: 'Choisissez la langue de l’interface.',
  settingsUnavailable: 'Réglages indisponibles',
  settingsLoadError: 'Impossible de charger vos réglages.',
  saveError: 'Impossible d’enregistrer ce réglage.',
  actionImpossible: 'Action impossible.',
  malAddSuccess: 'Ajouté à votre liste MAL · Plan to watch',
  malListError: 'Impossible de modifier votre liste MAL.',
  episodeLabel: 'épisodes',
  profileNoData: 'Pas encore assez de données',
  profileHint: 'Continuez à noter et à commenter vos recommandations.',
  profileRefreshed: 'Profil actualisé',
  preferenceUpdated: 'Apparence mise à jour',
  notificationsEnabled: 'Notifications activées',
  notificationsDisabled: 'Notifications désactivées',
  notificationsDescription:
    'Désactivées par défaut. Chrome peut demander une autorisation supplémentaire lors d’une prochaine version.',
  system: 'Système',
  exclusionType: 'Type de préférence à exclure',
  genre: 'Genre',
  theme: 'Thème',
  searchExcluded: (kind) => `Rechercher un ${kind}`,
  excludedList: (kind) => `Liste des ${kind} exclus`,
  excluded: (kind, value) => `${kind} « ${value} » exclu des recommandations`,
  restored: (kind, value) => `${kind} « ${value} » réautorisé`,
  restore: 'Réautoriser',
  noExcluded: (kind) => `Aucun ${kind} exclu.`,
  clearCacheConfirmation:
    'La liste synchronisée sera supprimée. Vos préférences et feedbacks seront conservés.',
  deleteDataConfirmationTitle: 'Supprimer les données locales ?',
  deleteDataConfirmationMessage:
    'Cette action efface définitivement la liste, les feedbacks, le profil et les réglages locaux.',
  deleteDataConfirmationAction: 'Supprimer les données',
  disconnectConfirmationTitle: 'Déconnecter MyAnimeList ?',
  disconnectConfirmationMessage:
    'La session MAL et les données locales liées à ce compte seront supprimées.',
  disconnectConfirmationAction: 'Déconnecter',
  sectionHighlyCompatible: 'Très compatibles',
  sectionBecauseYouLiked: 'Parce que vous aimiez…',
  sectionHiddenGems: 'Pépites',
  sectionExplore: 'À explorer',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  closeLabel: 'Fermer',
  dismissNotificationLabel: 'Fermer la notification',
  ratingAria: (value, outOf) => `Note ${value} sur ${outOf}`,
  compatibilityAria: (value) => `${value} % de compatibilité`,
  matchCaption: 'compatibilité',
  coverAlt: (title) => `Couverture de ${title}`,
  languageEyebrow: 'LANGUE',
  authErrorMessage: authMessage(frenchAuthErrors),
  malListAuthRequired: 'Connectez votre compte MAL pour ajouter cet anime.',
  malListSessionExpired: 'Votre session MAL a expiré. Reconnectez votre compte.',
  malListUnavailable: 'MAL est momentanément indisponible. Réessayez dans un instant.',
  malListRefused: 'MAL a refusé la modification de votre liste.',
  dailyNotificationMessage: 'Votre prochaine recommandation vous attend.',
  backgroundActionFailed: 'Une erreur est survenue.',
  syncProgressFetching: 'Analyse de votre liste…',
  syncProgressFetchingCount: (count) => `Analyse de votre liste… ${count} anime récupérés`,
  syncProgressFetched: (count) => `✓ ${count} anime récupérés`,
  syncProgressGenres: '✓ Genres analysés',
  syncProgressPreferences: '✓ Préférences calculées',
  syncProgressComplete: 'Synchronisation terminée',
  syncCacheHit: 'Données disponibles localement',
  syncOfflineFallback: 'Réseau indisponible : données locales utilisées',
  syncErrorMessage: 'La synchronisation a échoué.',
  reasonGenre: (name) => `Vous aimez particulièrement ${name}`,
  reasonTheme: (name) => `Vous appréciez les histoires ${name.toLowerCase()}`,
  reasonStudio: (studio) => `Vous revenez souvent aux productions de ${studio}`,
  reasonStaff: 'Une équipe créative qui correspond à vos goûts',
  reasonRating: 'Un score MAL proche de vos anime préférés',
  reasonSafePick: 'Une valeur sûre pour commencer votre découverte',
  reasonProfileFit: 'Une découverte adaptée à votre profil',
  detectedRichWorlds: 'Goût pour les univers riches',
  detectedRichWorldsDetail: (name) =>
    `${name ?? 'Vos genres favoris'} revient régulièrement dans vos signaux.`,
  detectedComplexCharacters: 'Personnages complexes',
  detectedComplexCharactersDetail:
    'Vos signaux positifs se concentrent sur des histoires centrées sur les personnages.',
  detectedDiscerningTaste: 'Sélection exigeante',
  detectedDiscerningTasteDetail: (average) => `Votre score moyen est de ${average}/10.`,
  detectedRefinedProfile: 'Profil affiné par vos retours',
  detectedRefinedProfileDetail: (count) => `${count} retours ont ajusté vos préférences.`,
  providers: 'Comptes',
  providersEyebrow: 'FOURNISSEURS',
  providersIntro: 'Connectez MyAnimeList et/ou AniList, puis choisissez le compte actif.',
  providerActive: 'Actif',
  providerMakeActive: 'Définir comme actif',
  providerConnect: 'Connecter',
  providerDisconnect: 'Déconnecter',
  providerAnilistClientId: 'Client ID AniList',
  yourAnilistClientId: 'Votre Client ID AniList',
  anilistRedirectUriLabel: 'URL de redirection à enregistrer dans AniList',
  anilistOauthInstructions:
    'Créez une application sur anilist.co/settings/developer et enregistrez l’URL de redirection https://anilist.co/api/v2/oauth/pin, puis collez le Client ID ici. Aucun secret n’est requis.',
  anilistClientIdSaved: 'Client ID AniList enregistré',
  anilistClientIdReset: 'Client ID AniList réinitialisé',
  providerConnectedToast: (name) => `Compte ${name} connecté`,
  providerDisconnectedToast: (name) => `Compte ${name} déconnecté`,
  providerActiveToast: (name) => `Compte actif : ${name}`,
  openOnAnilist: 'Ouvrir sur AniList',
  viewAnilist: 'Voir la fiche complète sur AniList ↗',
  pinInstructions:
    'AniList s’est ouvert dans un nouvel onglet. Autorisez l’application, puis revenez ici : le bouton de connexion apparaîtra automatiquement.',
  pinDetected: 'Autorisation AniList détectée dans un onglet ouvert. Terminez la connexion :',
  pinSubmit: 'Terminer la connexion',
  providerSynced: (name) => `${name} synchronisé`,
  providerListConnected: (name) => `liste ${name} connectée`,
  providerConnectSignals: (name) => `Connectez ${name} pour personnaliser vos signaux.`,
  providerConnectAction: (name) => `Connecter ${name}`,
  providerAuthenticating: (name) => `Authentification ${name}…`,
  providerSyncListFirst: (name) =>
    `Synchronisez une liste ${name} contenant quelques anime pour recevoir vos premières recommandations.`,
  providerConnectToAnalyze: (name) =>
    `Connectez votre compte ${name} pour qu’AnimeLens puisse analyser vos goûts.`,
  providerListNotSynced: (name) => `Liste ${name} non synchronisée`,
  providerConnectToStart: (name) => `Connectez ${name} pour commencer`,
  providerAddSuccess: (name) => `Ajouté à votre liste ${name} · Plan to watch`,
  providerListError: (name) => `Impossible de modifier votre liste ${name}.`,
  providerConnectToAdd: (name) =>
    `Connectez ${name} pour ajouter cet anime directement à votre liste.`,
  providerScore: (name) => `Score ${name}`,
  listAuthRequired: (name) => `Connectez votre compte ${name} pour ajouter cet anime.`,
  listSessionExpired: (name) => `Votre session ${name} a expiré. Reconnectez votre compte.`,
  listUnavailable: (name) => `${name} est momentanément indisponible. Réessayez dans un instant.`,
  listRefused: (name) => `${name} a refusé la modification de votre liste.`,
};

const english: AppCopy = {
  ...french,
  languageName: 'English',
  newLabel: 'NEW',
  openDetails: 'View details',
  episodesShort: 'episodes',
  recommendationWhy: 'Why this recommendation',
  recommendationEngine: 'Recommendation Engine',
  hiddenGem: 'HIDDEN GEM',
  like: 'Like',
  dislike: 'Not for me',
  seen: 'Watched',
  notNow: 'Not now',
  connected: 'Connected',
  disconnected: 'Disconnected',
  discover: 'Discover',
  profile: 'Profile',
  settings: 'Settings',
  live: 'Live',
  offline: 'Offline',
  openSettings: 'Open settings',
  updateAvailable: (version) => `New version available · v${version}`,
  currentVersion: (version) => `Your version: v${version}`,
  update: 'Update',
  dislikeTitle: 'Why did you dislike this anime?',
  dislikeDescription:
    'Your answers help us improve future recommendations. You can select multiple reasons.',
  dislikeReasons: 'Dislike reasons',
  dislikeTheme: (name) => `I do not like the theme ${name}.`,
  dislikeGenre: (name) => `I do not like the ${name} genre.`,
  dislikeGeneral: 'I simply do not like this anime.',
  cancel: 'Cancel',
  send: 'Send',
  savedPreference: 'Preference saved',
  syncUnavailable: 'Synchronization unavailable',
  malConnected: 'MAL account connected',
  malDisconnected: 'MAL account disconnected',
  authUnavailable: 'Authentication service unavailable.',
  dashboardEyebrow: 'ANIMELENS DISCOVERY',
  hello: 'Hello',
  dashboardIntro: 'Here are the anime we selected for you.',
  connectedList: 'MAL list connected',
  connectSignals: 'Connect MAL to personalize your signals.',
  connectMal: 'Connect MAL',
  authenticating: 'Authenticating with MAL…',
  finalizingAccount: 'Finalizing account…',
  authHint:
    'This message is often related to the redirect URL or Client ID, not your internet connection.',
  recommendationsUnavailable: 'Recommendations unavailable',
  recommendationsError: 'Unable to calculate your recommendations.',
  retry: 'Retry',
  selectionPreparing: 'Your selection is being prepared',
  syncListFirst: 'Sync a MAL list containing some anime to receive your first recommendations.',
  connectToAnalyze: 'Connect your MAL account so AnimeLens can analyze your taste.',
  synchronize: 'Synchronize',
  offlineRecommendations: 'Offline · recommendations calculated from your local data',
  todayPick: 'TODAY’S PICK',
  recommendationOfTheDay: 'Recommendation of the day',
  analyzed: (count) => `${count} analyzed`,
  curatedSignal: 'CURATED SIGNAL',
  titles: (count) => `${count} titles`,
  noTitles: 'No titles in this category yet.',
  previousTitles: (title) => `Previous titles in ${title}`,
  nextTitles: (title) => `Next titles in ${title}`,
  loadingRecommendations: 'Loading recommendations',
  analyzingList: 'Analyzing your list…',
  cachedAnime: (count) => `${count} anime cached`,
  listNotSynced: 'MAL list not synchronized',
  localData: 'Offline · local data',
  lastSync: (date) => `Last sync: ${date}`,
  readyToImport: 'Ready to import your list',
  connectToStart: 'Connect MAL to get started',
  syncFailed: 'Sync failed',
  syncing: 'In progress…',
  animeNotFound: 'Anime not found',
  recommendationUnavailable: 'This recommendation is no longer available in your local data.',
  backToRecommendations: 'Back to recommendations',
  whyThisAnime: 'Why this anime was recommended',
  compatibility: 'COMPATIBILITY',
  greatMatch: 'Great match',
  exploreLead: 'Worth exploring',
  calculatedScore: 'Score calculated by the AnimeLens engine.',
  addToList: 'Add to my list',
  adding: 'Adding…',
  alreadyInList: 'Already in my list',
  openOnMal: 'Open on MAL',
  connectToAdd: 'Connect MAL to add this anime directly to your list.',
  viewMal: 'View the full page on MyAnimeList ↗',
  profileEyebrow: 'YOUR ANIME PROFILE',
  animeProfile: 'Your anime profile',
  profileIntro: 'What AnimeLens learned from your anime and feedback.',
  analyzedAnime: 'anime analyzed',
  averageScore: 'Average score',
  ratedAnime: 'Rated anime',
  favoriteGenres: 'Favorite genres',
  favoriteThemes: 'Favorite themes',
  favoriteStudios: 'Favorite studios',
  detectedPreferences: 'Detected preferences',
  learned: 'Learned',
  noSignals: 'Not enough consistent signals yet.',
  positiveSignal: 'POSITIVE SIGNAL',
  negativeSignal: 'NEGATIVE SIGNAL',
  lessLikedGenres: 'Less-liked genres',
  profileCalculated: 'Profile calculated from your local data.',
  refresh: 'Refresh',
  tasteCardShare: 'Share my taste card',
  tasteCardTitle: 'Your taste card',
  tasteCardIntro: 'Download or copy an image of your profile to share on Discord, X, Reddit…',
  tasteCardPreviewLabel: 'Taste card preview',
  tasteCardSubtitle: 'Anime taste profile',
  tasteCardAnalyzed: 'In List',
  tasteCardAverageScore: 'Average score',
  tasteCardRated: 'Scored',
  tasteCardTopGenres: 'Top genres',
  tasteCardTopRated: 'Top rated',
  tasteCardAffinity: '% affinity',
  tasteCardNoGenres: 'Not enough data yet.',
  tasteCardFooter: 'Made with AnimeLens',
  tasteCardFormat: 'Card format',
  tasteCardFormatPortrait: 'Portrait 4:5',
  tasteCardFormatSquare: 'Square 1:1',
  tasteCardFormatTall: 'Tall 3:4',
  tasteCardDownload: 'Download PNG',
  tasteCardCopy: 'Copy image',
  tasteCardGenerating: 'Generating…',
  tasteCardDownloaded: 'Taste card downloaded.',
  tasteCardCopied: 'Taste card copied to the clipboard.',
  tasteCardCopyFailed: 'Clipboard unavailable — the image was downloaded instead.',
  tasteCardCopyUnsupported: 'Image copy is not supported here — use the download instead.',
  tasteCardRenderFailed: 'Could not generate the taste card. Please try again.',
  topPicksTitle: 'Choose your Top 3',
  topPicksIntroTie: (count, score) =>
    `${count} anime are tied at ${score}/10. Choose which one takes the last slot.`,
  topPicksIntroManual: (count, score) =>
    `${count} anime are tied at ${score}/10. Change your pick.`,
  topPicksSelectSlot: (position) => `Select your #${position} anime`,
  topPicksSlotLocked: 'Filled automatically',
  topPicksSlotChosen: 'Your pick',
  topPicksChosenBadge: 'Chosen',
  topPicksSkipDefault: 'Skip & Use Default',
  topPicksDefaultHint: 'By default, the most recently updated anime is used.',
  topPicksDefaultUsed: 'Used your most recently updated anime.',
  topPicksUpdated: 'Top 3 updated.',
  topPicksResetDone: 'Ranking reset. Choose again.',
  topPicksChange: 'Change my picks',
  topPicksLoadFailed: 'Could not load your Top 3 picks.',
  topPicksSaveFailed: 'Could not save your Top 3.',
  topPicksNoCandidates: 'No candidates available.',
  tasteCardOptionsTitle: 'Card content',
  tasteCardShowGenres: 'Show top genres',
  tasteCardShowPicks: 'Show top rated',
  tasteCardCoverSize: 'Cover size',
  tasteCardPicksLayout: 'Top rated layout',
  tasteCardLayoutList: 'List',
  tasteCardLayoutTriangle: 'Triangle',
  tasteCardLayoutGrid: '3×3 grid',
  tasteCardGridTitle: 'Build your 3×3 grid',
  tasteCardGridIntro: (filled, total) =>
    `Choose ${total} anime for your grid — ${filled} of ${total} selected. Nothing is saved.`,
  tasteCardGridSlot: (position) => `Box ${position}`,
  tasteCardGridFilled: 'Filled',
  tasteCardGridActive: (slot) => `Now filling ${slot} — pick an anime below.`,
  tasteCardGridAllFilled: 'All nine boxes are filled.',
  tasteCardGridEmptyBox: 'Empty',
  tasteCardGridSearch: 'Search your rated anime',
  tasteCardGridNoMatches: 'No anime matches your search.',
  tasteCardGridDone: 'Grid ready',
  tasteCardGridNotPersisted: 'Your grid is not saved — pick again next time.',
  tasteCardCoverSizeValue: (scale) => `${Math.round(scale * 100)}%`,
  tasteCardCoverSizeCapped: 'Larger once a section is hidden.',
  tasteCardOptionsSaved: 'Card preferences saved.',
  tasteCardAssetFailed: 'The card could not load your avatar. Please try again.',
  settingsEyebrow: 'PERSONALIZE',
  settingsTitle: 'Settings',
  settingsIntro: 'An experience that adapts to the way you discover.',
  accountSummary: 'Account and preference summary',
  accountNotConnected: 'Account not connected',
  malSynced: 'MAL synchronized',
  mode: 'Mode',
  personalized: 'Personalized',
  exploratory: 'Exploratory',
  account: 'Account',
  malStatus: 'MAL status',
  connectedAs: (username) => `Connected as ${username}`,
  noAccount: 'No account connected',
  connectAccountDescription: 'Connect your account to personalize recommendations',
  importLatestList: 'Import the latest version of your list',
  removeAccount: 'Remove the MAL account from this extension',
  disconnect: 'Disconnect',
  oauthConfig: 'Configuration',
  malClientId: 'MAL Client ID',
  sharedFolderDescription:
    'Use your own MAL application when this extension was loaded from a shared folder.',
  yourMalClientId: 'Your MAL Client ID',
  redirectUri: 'Redirect URL to register in MAL',
  oauthInstructions:
    'Create an OAuth application on MyAnimeList, add this URL exactly, then save the Client ID. A Client Secret is not required.',
  saveClientId: 'Save Client ID',
  saving: 'Saving…',
  clientIdSaved: 'MAL Client ID saved',
  clientIdReset: 'MAL Client ID reset',
  recommendations: 'Recommendations',
  discovery: 'DISCOVERY',
  hiddenGems: 'Hidden gems',
  hiddenGemsDescription: 'Discover less popular anime',
  olderAnime: 'Older anime',
  olderAnimeDescription: 'Include titles released before 2010',
  movies: 'Movies',
  moviesDescription: 'Include feature films',
  shortSeries: 'Short series',
  shortSeriesDescription: 'Favor series with 13 episodes or fewer',
  discoveryStyle: 'Discovery style',
  discoveryStyleDescription: 'Choose the balance between affinity and surprise.',
  appearance: 'Appearance',
  interfaceLabel: 'INTERFACE',
  notifications: 'Notifications',
  reminders: 'REMINDERS',
  dailyRecommendation: 'Daily recommendation',
  dailyRecommendationDescription: 'Receive a suggestion every day',
  data: 'Data',
  localStorage: 'LOCAL STORAGE',
  clearCache: 'Clear cache',
  clearCacheDescription: 'Remove the synchronized list while keeping preferences',
  deleteLocalData: 'Delete local data',
  deleteLocalDataDescription: 'Erase list, feedback, profile, and preferences',
  language: 'Language',
  french: 'Français',
  english: 'English',
  languageDescription: 'Choose the interface language.',
  settingsUnavailable: 'Settings unavailable',
  settingsLoadError: 'Unable to load your settings.',
  saveError: 'Unable to save this setting.',
  actionImpossible: 'Action unavailable.',
  malAddSuccess: 'Added to your MAL list · Plan to watch',
  malListError: 'Unable to modify your MAL list.',
  episodeLabel: 'episodes',
  profileNoData: 'Not enough data yet',
  profileHint: 'Keep rating and commenting on your recommendations.',
  profileRefreshed: 'Profile refreshed',
  preferenceUpdated: 'Appearance updated',
  notificationsEnabled: 'Notifications enabled',
  notificationsDisabled: 'Notifications disabled',
  notificationsDescription:
    'Disabled by default. Chrome may request additional permission in a future version.',
  system: 'System',
  exclusionType: 'Preference type to exclude',
  genre: 'Genre',
  theme: 'Theme',
  searchExcluded: (kind) => `Search for a ${kind}`,
  excludedList: (kind) => `List of excluded ${kind}`,
  excluded: (kind, value) => `${kind} “${value}” excluded from recommendations`,
  restored: (kind, value) => `${kind} “${value}” allowed again`,
  restore: 'Allow again',
  noExcluded: (kind) => `No excluded ${kind}.`,
  clearCacheConfirmation:
    'The synchronized list will be removed. Your preferences and feedback will be kept.',
  deleteDataConfirmationTitle: 'Delete local data?',
  deleteDataConfirmationMessage:
    'This permanently erases your list, feedback, profile, and local settings.',
  deleteDataConfirmationAction: 'Delete data',
  disconnectConfirmationTitle: 'Disconnect MyAnimeList?',
  disconnectConfirmationMessage:
    'The MAL session and local data linked to this account will be removed.',
  disconnectConfirmationAction: 'Disconnect',
  genres: 'Genres',
  themes: 'Themes',
  studio: 'Studio',
  malScore: 'MAL score',
  episodes: 'Episodes',
  year: 'Year',
  sectionHighlyCompatible: 'Highly Compatible',
  sectionBecauseYouLiked: 'Because You Liked...',
  sectionHiddenGems: 'Hidden gems',
  sectionExplore: 'Explore',
  themeLight: 'Light',
  themeDark: 'Dark',
  closeLabel: 'Close',
  dismissNotificationLabel: 'Dismiss notification',
  ratingAria: (value, outOf) => `Rating ${value} out of ${outOf}`,
  compatibilityAria: (value) => `${value} percent compatibility`,
  matchCaption: 'match',
  coverAlt: (title) => `Cover of ${title}`,
  languageEyebrow: 'LANGUAGE',
  authErrorMessage: authMessage(englishAuthErrors),
  malListAuthRequired: 'Connect your MAL account to add this anime.',
  malListSessionExpired: 'Your MAL session has expired. Reconnect your account.',
  malListUnavailable: 'MAL is temporarily unavailable. Try again in a moment.',
  malListRefused: 'MAL refused the change to your list.',
  dailyNotificationMessage: 'Your next recommendation is waiting.',
  backgroundActionFailed: 'Something went wrong.',
  syncProgressFetching: 'Analyzing your list…',
  syncProgressFetchingCount: (count) => `Analyzing your list… ${count} anime fetched`,
  syncProgressFetched: (count) => `✓ ${count} anime fetched`,
  syncProgressGenres: '✓ Genres analyzed',
  syncProgressPreferences: '✓ Preferences calculated',
  syncProgressComplete: 'Synchronization complete',
  syncCacheHit: 'Local data available',
  syncOfflineFallback: 'Network unavailable: local data used',
  syncErrorMessage: 'Synchronization failed.',
  reasonGenre: (name) => `You particularly enjoy ${name}`,
  reasonTheme: (name) => `You enjoy ${name.toLowerCase()} stories`,
  reasonStudio: (studio) => `You often come back to ${studio} productions`,
  reasonStaff: 'A creative team that matches your taste',
  reasonRating: 'A MAL score close to your favorite anime',
  reasonSafePick: 'A safe bet to start your discovery',
  reasonProfileFit: 'A discovery suited to your profile',
  detectedRichWorlds: 'Taste for rich worlds',
  detectedRichWorldsDetail: (name) =>
    `${name ?? 'Your favorite genres'} keeps coming back in your signals.`,
  detectedComplexCharacters: 'Complex characters',
  detectedComplexCharactersDetail: 'Your positive signals focus on character-driven stories.',
  detectedDiscerningTaste: 'Discerning taste',
  detectedDiscerningTasteDetail: (average) => `Your average score is ${average}/10.`,
  detectedRefinedProfile: 'Profile refined by your feedback',
  detectedRefinedProfileDetail: (count) => `${count} responses have adjusted your preferences.`,
  providers: 'Accounts',
  providersEyebrow: 'PROVIDERS',
  providersIntro: 'Connect MyAnimeList and/or AniList, then pick the active account.',
  providerActive: 'Active',
  providerMakeActive: 'Make active',
  providerConnect: 'Connect',
  providerDisconnect: 'Disconnect',
  providerAnilistClientId: 'AniList Client ID',
  yourAnilistClientId: 'Your AniList Client ID',
  anilistRedirectUriLabel: 'Redirect URL to register in AniList',
  anilistOauthInstructions:
    'Create an application at anilist.co/settings/developer and register the redirect URL https://anilist.co/api/v2/oauth/pin, then paste the Client ID here. No secret is required.',
  anilistClientIdSaved: 'AniList Client ID saved',
  anilistClientIdReset: 'AniList Client ID reset',
  providerConnectedToast: (name) => `${name} account connected`,
  providerDisconnectedToast: (name) => `${name} account disconnected`,
  providerActiveToast: (name) => `Active account: ${name}`,
  openOnAnilist: 'Open on AniList',
  viewAnilist: 'View the full page on AniList ↗',
  pinInstructions:
    'AniList opened in a new tab. Authorize the app, then come back here: the connect button will appear automatically.',
  pinDetected: 'AniList authorization detected in an open tab. Finish connecting:',
  pinSubmit: 'Finish connecting',
  providerSynced: (name) => `${name} synchronized`,
  providerListConnected: (name) => `${name} list connected`,
  providerConnectSignals: (name) => `Connect ${name} to personalize your signals.`,
  providerConnectAction: (name) => `Connect ${name}`,
  providerAuthenticating: (name) => `Authenticating with ${name}…`,
  providerSyncListFirst: (name) =>
    `Sync a ${name} list containing some anime to receive your first recommendations.`,
  providerConnectToAnalyze: (name) =>
    `Connect your ${name} account so AnimeLens can analyze your taste.`,
  providerListNotSynced: (name) => `${name} list not synchronized`,
  providerConnectToStart: (name) => `Connect ${name} to get started`,
  providerAddSuccess: (name) => `Added to your ${name} list · Plan to watch`,
  providerListError: (name) => `Unable to modify your ${name} list.`,
  providerConnectToAdd: (name) => `Connect ${name} to add this anime directly to your list.`,
  providerScore: (name) => `${name} score`,
  listAuthRequired: (name) => `Connect your ${name} account to add this anime.`,
  listSessionExpired: (name) => `Your ${name} session has expired. Reconnect your account.`,
  listUnavailable: (name) => `${name} is temporarily unavailable. Try again in a moment.`,
  listRefused: (name) => `${name} refused the change to your list.`,
};

export function normalizeLanguage(value: unknown): Language {
  return value === 'fr' || (typeof value === 'string' && value.toLocaleLowerCase().startsWith('fr'))
    ? 'fr'
    : 'en';
}

export function detectBrowserLanguage(): Language {
  return normalizeLanguage(typeof navigator === 'undefined' ? undefined : navigator.language);
}

export function getCopy(language: Language): AppCopy {
  return language === 'en' ? english : french;
}
