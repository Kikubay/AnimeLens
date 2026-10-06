import { describe, expect, it } from 'vitest';
import type { AuthErrorCode } from '../src/auth/auth-types';
import { getCopy, normalizeLanguage } from '../src/locales';

// Brand lines, all-caps eyebrows and words spelled the same in both languages.
const INTENTIONALLY_SAME_KEYS = new Set([
  'dashboardEyebrow',
  'genres',
  'studio',
  'mode',
  'interfaceLabel',
  'notifications',
  'french',
  'english',
  'genre',
  'oauthConfig',
  'tasteCardFormatPortrait',
  'tasteCardLayoutTriangle',
  'brandWordmark',
  'dailyNotificationTitle',
  'oauthEyebrow',
]);

const FUNCTION_ARGS: Record<string, readonly unknown[]> = {
  authErrorMessage: ['cancelled', 'raw fallback'],
};

function evaluate(value: unknown, args: readonly unknown[]): unknown {
  return typeof value === 'function' ? (value as (...a: unknown[]) => unknown)(...args) : value;
}

describe('localization', () => {
  it('normalizes supported and unsupported language values', () => {
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe('fr');
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(normalizeLanguage('de-DE')).toBe('en');
  });

  it('provides distinct French and English interface copy', () => {
    expect(getCopy('fr').settings).toBe('Réglages');
    expect(getCopy('en').settings).toBe('Settings');
    expect(getCopy('en').connectMal).toBe('Connect MAL');
  });

  it('exposes the same key set in both languages', () => {
    const french = getCopy('fr') as unknown as Record<string, unknown>;
    const english = getCopy('en') as unknown as Record<string, unknown>;
    expect(Object.keys(english).sort()).toEqual(Object.keys(french).sort());
  });

  it('never leaks French values into the English copy (or vice versa)', () => {
    const french = getCopy('fr') as unknown as Record<string, unknown>;
    const english = getCopy('en') as unknown as Record<string, unknown>;
    const leaks: string[] = [];
    for (const key of Object.keys(french)) {
      if (INTENTIONALLY_SAME_KEYS.has(key)) continue;
      const args = FUNCTION_ARGS[key] ?? ['Test', 7];
      const frenchValue = evaluate(french[key], args);
      const englishValue = evaluate(english[key], args);
      if (frenchValue === englishValue) leaks.push(key);
    }
    expect(leaks).toEqual([]);
  });

  it('keeps the detail-page labels translated in English', () => {
    const english = getCopy('en');
    expect(english.genres).toBe('Genres');
    expect(english.themes).toBe('Themes');
    expect(english.studio).toBe('Studio');
    expect(english.malScore).toBe('MAL score');
    expect(english.episodes).toBe('Episodes');
    expect(english.year).toBe('Year');
  });

  it('keeps previously untranslated French strings French', () => {
    const french = getCopy('fr');
    expect(french.connectMal).toBe('Connecter MAL');
    expect(french.hiddenGems).toBe('Pépites');
    expect(french.settingsEyebrow).toBe('PERSONNALISATION');
    expect(french.reminders).toBe('RAPPELS');
    expect(french.discovery).toBe('DÉCOUVERTE');
    expect(french.localStorage).toBe('STOCKAGE LOCAL');
    expect(french.todayPick).toBe('SÉLECTION DU JOUR');
  });

  it('localizes theme labels, section titles, and a11y strings', () => {
    expect(getCopy('en').themeLight).toBe('Light');
    expect(getCopy('en').themeDark).toBe('Dark');
    expect(getCopy('fr').themeLight).toBe('Clair');
    expect(getCopy('fr').themeDark).toBe('Sombre');
    expect(getCopy('en').sectionHighlyCompatible).toBe('Highly Compatible');
    expect(getCopy('fr').sectionHighlyCompatible).toBe('Très compatibles');
    expect(getCopy('en').matchCaption).toBe('match');
    expect(getCopy('fr').matchCaption).toBe('compatibilité');
    expect(getCopy('fr').languageEyebrow).toBe('LANGUE');
  });

  it('maps auth error codes to localized messages', () => {
    expect(getCopy('fr').authErrorMessage('cancelled', 'raw')).toBe(
      'L’authentification a été annulée.',
    );
    expect(getCopy('en').authErrorMessage('cancelled', 'raw')).toBe(
      'Authentication was cancelled.',
    );
    expect(getCopy('fr').authErrorMessage(null, 'raw message')).toBe('raw message');
  });

  it('translates every auth error code, so no raw English reaches the UI', () => {
    const codes: readonly AuthErrorCode[] = [
      'configuration',
      'cancelled',
      'invalid_callback',
      'state_mismatch',
      'token_exchange',
      'profile_fetch',
      'token_expired',
      'network_error',
      'session_expired',
      'invalid_redirect_uri',
      'mal_configuration',
      'provider_configuration',
      'pin_flow_started',
      'unknown',
    ];
    for (const code of codes) {
      const english = getCopy('en').authErrorMessage(code, 'FALLBACK');
      const french = getCopy('fr').authErrorMessage(code, 'FALLBACK');
      expect(english, code).not.toBe('FALLBACK');
      expect(french, code).not.toBe('FALLBACK');
      expect(french, code).not.toBe(english);
    }
  });
});

// The leak check above only catches *identical* values, so a swapped pair (French in the English table, English in the French one) slips through; this pins the wording in both directions.
const TASTE_CARD_STRINGS: readonly (readonly [string, string, string])[] = [
  ['tasteCardShare', 'Partager ma carte de goûts', 'Share my taste card'],
  ['tasteCardTitle', 'Votre carte de goûts', 'Your taste card'],
  ['tasteCardPreviewLabel', 'Aperçu de la carte de goûts', 'Taste card preview'],
  ['tasteCardSubtitle', 'Profil de goûts anime', 'Anime taste profile'],
  ['tasteCardAnalyzed', 'Dans la liste', 'In List'],
  ['tasteCardAverageScore', 'Score moyen', 'Average score'],
  ['tasteCardRated', 'Notés', 'Scored'],
  ['tasteCardTopGenres', 'Genres favoris', 'Top genres'],
  ['tasteCardAffinity', '% d’affinité', '% affinity'],
  ['tasteCardNoGenres', 'Pas encore assez de données.', 'Not enough data yet.'],
  ['tasteCardFooter', 'Réalisé avec AnimeLens', 'Made with AnimeLens'],
  ['tasteCardFormat', 'Format de la carte', 'Card format'],
  ['tasteCardFormatSquare', 'Carré 1:1', 'Square 1:1'],
  ['tasteCardFormatTall', 'Vertical 3:4', 'Tall 3:4'],
  ['tasteCardDownload', 'Télécharger le PNG', 'Download PNG'],
  ['tasteCardCopy', 'Copier l’image', 'Copy image'],
  ['tasteCardGenerating', 'Génération…', 'Generating…'],
  ['tasteCardDownloaded', 'Carte de goûts téléchargée.', 'Taste card downloaded.'],
  [
    'tasteCardCopied',
    'Carte de goûts copiée dans le presse-papiers.',
    'Taste card copied to the clipboard.',
  ],
  [
    'tasteCardCopyFailed',
    'Presse-papiers indisponible — l’image a été téléchargée à la place.',
    'Clipboard unavailable — the image was downloaded instead.',
  ],
  [
    'tasteCardCopyUnsupported',
    'Copie d’images non prise en charge ici — utilisez le téléchargement.',
    'Image copy is not supported here — use the download instead.',
  ],
  [
    'tasteCardRenderFailed',
    'Impossible de générer la carte de goûts. Réessayez.',
    'Could not generate the taste card. Please try again.',
  ],
  ['tasteCardOptionsTitle', 'Contenu de la carte', 'Card content'],
  ['tasteCardShowGenres', 'Afficher les genres favoris', 'Show top genres'],
  ['tasteCardShowPicks', 'Afficher les mieux notés', 'Show top rated'],
  ['tasteCardCoverSize', 'Taille des couvertures', 'Cover size'],
  ['tasteCardPicksLayout', 'Disposition des mieux notés', 'Top rated layout'],
  ['tasteCardLayoutList', 'Liste', 'List'],
  ['tasteCardLayoutGrid', 'Grille 3×3', '3×3 grid'],
  ['tasteCardGridTitle', 'Composez votre grille 3×3', 'Build your 3×3 grid'],
  ['tasteCardGridFilled', 'Remplie', 'Filled'],
  ['tasteCardGridAllFilled', 'Les neuf cases sont remplies.', 'All nine boxes are filled.'],
  ['tasteCardGridEmptyBox', 'Vider', 'Empty'],
  ['tasteCardGridSearch', 'Rechercher vos anime notés', 'Search your rated anime'],
  [
    'tasteCardGridNoMatches',
    'Aucun anime ne correspond à votre recherche.',
    'No anime matches your search.',
  ],
  ['tasteCardGridDone', 'Grille prête', 'Grid ready'],
  [
    'tasteCardGridNotPersisted',
    'Votre grille n’est pas enregistrée — à refaire la prochaine fois.',
    'Your grid is not saved — pick again next time.',
  ],
  [
    'tasteCardCoverSizeCapped',
    'Plus grand en masquant une section.',
    'Larger once a section is hidden.',
  ],
  ['tasteCardOptionsSaved', 'Préférences de la carte enregistrées.', 'Card preferences saved.'],
  [
    'tasteCardAssetFailed',
    'La carte n’a pas pu charger votre avatar. Réessayez ou déconnectez-vous.',
    'The card could not load your avatar. Please try again.',
  ],
  ['topPicksTitle', 'Choisissez votre Top 3', 'Choose your Top 3'],
  ['topPicksSlotLocked', 'Rempli automatiquement', 'Filled automatically'],
  ['topPicksSlotChosen', 'Votre choix', 'Your pick'],
  ['topPicksChosenBadge', 'Choisi', 'Chosen'],
  ['topPicksSkipDefault', 'Ignorer et utiliser l’ordre par défaut', 'Skip & Use Default'],
  [
    'topPicksDefaultHint',
    'Par défaut, le plus récemment mis à jour est retenu.',
    'By default, the most recently updated anime is used.',
  ],
  [
    'topPicksDefaultUsed',
    'Utilisation de l anime le plus récemment mis à jour.',
    'Used your most recently updated anime.',
  ],
  ['topPicksUpdated', 'Top 3 mis à jour.', 'Top 3 updated.'],
  [
    'topPicksResetDone',
    'Classement réinitialisé. Choisissez à nouveau.',
    'Ranking reset. Choose again.',
  ],
  ['topPicksChange', 'Modifier mes choix', 'Change my picks'],
  [
    'topPicksLoadFailed',
    'Impossible de charger vos choix du Top 3.',
    'Could not load your Top 3 picks.',
  ],
  ['topPicksSaveFailed', 'Impossible d’enregistrer votre Top 3.', 'Could not save your Top 3.'],
  ['topPicksNoCandidates', 'Aucun candidat disponible.', 'No candidates available.'],
];

function strings(language: 'fr' | 'en'): Record<string, string> {
  return getCopy(language) as unknown as Record<string, string>;
}

describe('taste card copy', () => {
  it('has the right string in each language for every taste card label', () => {
    for (const [key, expectedFrench, expectedEnglish] of TASTE_CARD_STRINGS) {
      expect(strings('en')[key], `en.${key}`).toBe(expectedEnglish);
      expect(strings('fr')[key], `fr.${key}`).toBe(expectedFrench);
    }
  });

  it('never leaks one language into the other', () => {
    for (const [key] of TASTE_CARD_STRINGS) {
      const french = strings('fr')[key];
      const english = strings('en')[key];
      expect(french, key).not.toBe(english);
      expect(english, `en.${key}`).not.toMatch(/[éèêëàâçîïôûœ]/i);
      expect(french, `fr.${key}`).not.toMatch(
        /\b(the|and|your|with|choose|is filled|not saved)\b/i,
      );
    }
  });

  it('formats the count-based and slot-based labels in each language', () => {
    expect(getCopy('en').tasteCardGridSlot(3)).toBe('Box 3');
    expect(getCopy('fr').tasteCardGridSlot(3)).toBe('Case 3');
    expect(getCopy('en').tasteCardGridIntro(4, 9)).toContain('4 of 9');
    expect(getCopy('fr').tasteCardGridIntro(4, 9)).toContain('4 sur 9');
    expect(getCopy('en').tasteCardGridActive('Box 2')).toContain('Box 2');
    expect(getCopy('fr').tasteCardGridActive('Case 2')).toContain('Case 2');
    expect(getCopy('en').tasteCardCoverSizeValue(1.5)).toBe('150%');
    expect(getCopy('fr').tasteCardCoverSizeValue(1.5)).toBe(' 150 % ');
    expect(getCopy('en').topPicksSelectSlot(2)).toBe('Select your #2 anime');
    expect(getCopy('fr').topPicksSelectSlot(2)).toBe('Choisissez votre anime n°2');
    expect(getCopy('en').topPicksIntroTie(5, 9)).toContain('5 anime are tied at 9/10');
    expect(getCopy('fr').topPicksIntroTie(5, 9)).toContain('5 anime sont à égalité à 9/10');
    expect(getCopy('en').tasteCardIntro).toMatch(/^Download/);
    expect(getCopy('fr').tasteCardIntro).toMatch(/^Téléchargez/);
  });
});
