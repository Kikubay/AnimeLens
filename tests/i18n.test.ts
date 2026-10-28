import { describe, expect, it } from 'vitest';
import type { AuthErrorCode } from '../src/auth/auth-types';
import { getCopy, LANGUAGES, normalizeLanguage, type Language } from '../src/locales';

const LANGUAGES_EXCEPT_EN: readonly Language[] = LANGUAGES.filter((language) => language !== 'en');

// Values that are legitimately identical for a given pair: brand names, format acronyms and each language's own name.
const PAIRWISE_IDENTICAL: Readonly<
  ReadonlyArray<readonly [Language, Language, readonly string[]]>
> = [
  [
    'fr',
    'en',
    [
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
      'searchFormatTv',
      'tasteCardStyleTitle',
      'cosmeticPaletteMono',
      'cosmeticSlotPalette',
    ],
  ],
  [
    'es',
    'en',
    [
      'dashboardEyebrow',
      'brandWordmark',
      'betaBadge',
      'cosmeticPaletteAurora',
      'cosmeticPaletteMono',
      'oauthEyebrow',
      'french',
      'english',
      'dailyNotificationTitle',
      'searchFormatTv',
      'searchFormatOva',
      'searchFormatOna',
    ],
  ],
  [
    'es',
    'fr',
    [
      'dashboardEyebrow',
      'brandWordmark',
      'cosmeticPaletteMono',
      'oauthEyebrow',
      'french',
      'english',
      'spanish',
      'dailyNotificationTitle',
      'searchFormatTv',
    ],
  ],
];

const LANGUAGE_PAIRS: ReadonlyArray<readonly [Language, Language]> = [
  ['fr', 'en'],
  ['es', 'en'],
  ['es', 'fr'],
];

function sharedKeys(left: Language, right: Language): ReadonlySet<string> {
  const pair = PAIRWISE_IDENTICAL.find(
    ([a, b]) => (a === left && b === right) || (a === right && b === left),
  );
  return new Set(pair?.[2] ?? []);
}

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
    expect(normalizeLanguage('es')).toBe('es');
    expect(normalizeLanguage('es-MX')).toBe('es');
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(normalizeLanguage('de-DE')).toBe('en');
  });

  it('provides distinct copy in French, English and Spanish', () => {
    expect(getCopy('fr').settings).toBe('Réglages');
    expect(getCopy('en').settings).toBe('Settings');
    expect(getCopy('es').settings).toBe('Ajustes');
    expect(getCopy('en').connectMal).toBe('Connect MAL');
    expect(getCopy('es').connectMal).toBe('Conectar MAL');
  });

  it('exposes the same key set in every language', () => {
    const english = Object.keys(getCopy('en') as unknown as Record<string, unknown>).sort();
    for (const language of LANGUAGES_EXCEPT_EN) {
      const other = Object.keys(getCopy(language) as unknown as Record<string, unknown>);
      expect(other.sort(), language).toEqual(english);
    }
  });

  it('never leaks one language into another', () => {
    for (const [left, right] of LANGUAGE_PAIRS) {
      const leftCopy = getCopy(left) as unknown as Record<string, unknown>;
      const rightCopy = getCopy(right) as unknown as Record<string, unknown>;
      const shared = sharedKeys(left, right);
      const leaks: string[] = [];
      for (const key of Object.keys(leftCopy)) {
        if (shared.has(key)) continue;
        const args = FUNCTION_ARGS[key] ?? ['Test', 7];
        if (evaluate(leftCopy[key], args) === evaluate(rightCopy[key], args)) leaks.push(key);
      }
      expect(leaks, `${left} vs ${right}`).toEqual([]);
    }
  });

  it('keeps the detail-page labels translated in English and Spanish', () => {
    const english = getCopy('en');
    expect(english.genres).toBe('Genres');
    expect(english.themes).toBe('Themes');
    expect(english.studio).toBe('Studio');
    expect(english.malScore).toBe('MAL score');
    expect(english.episodes).toBe('Episodes');
    expect(english.year).toBe('Year');
    const spanish = getCopy('es');
    expect(spanish.genres).toBe('Géneros');
    expect(spanish.themes).toBe('Temas');
    expect(spanish.studio).toBe('Estudio');
    expect(spanish.malScore).toBe('Puntuación MAL');
    expect(spanish.episodes).toBe('Episodios');
    expect(spanish.year).toBe('Año');
  });

  it('keeps previously untranslated French strings French', () => {
    const french = getCopy('fr');
    expect(french.connectMal).toBe('Connecter MAL');
    expect(french.hiddenGems).toBe('Pépites');
    expect(french.settingsEyebrow).toBe('Personnalisation');
    expect(french.reminders).toBe('Rappels');
    expect(french.discovery).toBe('Découverte');
    expect(french.localStorage).toBe('Stockage local');
    expect(french.todayPick).toBe('Sélection du jour');
  });

  it('keeps the section eyebrows Spanish', () => {
    const spanish = getCopy('es');
    expect(spanish.settingsEyebrow).toBe('Personalización');
    expect(spanish.reminders).toBe('Recordatorios');
    expect(spanish.discovery).toBe('Descubrimiento');
    expect(spanish.localStorage).toBe('Almacenamiento local');
    expect(spanish.todayPick).toBe('Selección del día');
    expect(spanish.languageEyebrow).toBe('Idioma');
  });

  it('localizes theme labels, section titles, and a11y strings', () => {
    expect(getCopy('en').themeLight).toBe('Light');
    expect(getCopy('en').themeDark).toBe('Dark');
    expect(getCopy('fr').themeLight).toBe('Clair');
    expect(getCopy('fr').themeDark).toBe('Sombre');
    expect(getCopy('es').themeLight).toBe('Claro');
    expect(getCopy('es').themeDark).toBe('Oscuro');
    expect(getCopy('en').accentTheme).toBe('Accent color');
    expect(getCopy('fr').accentTheme).toBe("Couleur d'accent");
    expect(getCopy('es').accentTheme).toBe('Color de acento');
    expect(getCopy('en').accentPurple).toBe('Purple');
    expect(getCopy('fr').accentPurple).toBe('Violet');
    expect(getCopy('es').accentPurple).toBe('Púrpura');
    expect(getCopy('en').accentRed).toBe('Red');
    expect(getCopy('fr').accentRed).toBe('Rouge');
    expect(getCopy('es').accentRed).toBe('Rojo');
    expect(getCopy('en').sectionHighlyCompatible).toBe('Highly Compatible');
    expect(getCopy('fr').sectionHighlyCompatible).toBe('Très compatibles');
    expect(getCopy('es').sectionHighlyCompatible).toBe('Muy compatibles');
    expect(getCopy('en').matchCaption).toBe('match');
    expect(getCopy('fr').matchCaption).toBe('compatibilité');
    expect(getCopy('es').matchCaption).toBe('coincidencia');
    expect(getCopy('fr').languageEyebrow).toBe('Langue');
  });

  it('maps auth error codes to localized messages', () => {
    expect(getCopy('fr').authErrorMessage('cancelled', 'raw')).toBe(
      'L’authentification a été annulée.',
    );
    expect(getCopy('en').authErrorMessage('cancelled', 'raw')).toBe(
      'Authentication was cancelled.',
    );
    expect(getCopy('es').authErrorMessage('cancelled', 'raw')).toBe(
      'Se ha cancelado la autenticación.',
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
      const rendered = LANGUAGES.map((language) =>
        getCopy(language).authErrorMessage(code, 'FALLBACK'),
      );
      for (const [index, message] of rendered.entries()) {
        expect(message, `${LANGUAGES[index]}.${code}`).not.toBe('FALLBACK');
      }
      expect(new Set(rendered).size, code).toBe(rendered.length);
    }
  });
});

const TASTE_CARD_STRINGS: readonly (readonly [string, string, string, string])[] = [
  [
    'tasteCardShare',
    'Partager ma carte de goûts',
    'Share my taste card',
    'Compartir mi tarjeta de gustos',
  ],
  ['tasteCardTitle', 'Votre carte de goûts', 'Your taste card', 'Tu tarjeta de gustos'],
  [
    'tasteCardPreviewLabel',
    'Aperçu de la carte de goûts',
    'Taste card preview',
    'Vista previa de la tarjeta de gustos',
  ],
  ['tasteCardSubtitle', 'Profil de goûts anime', 'Anime taste profile', 'Perfil de gustos anime'],
  ['tasteCardAnalyzed', 'Dans la liste', 'In List', 'En la lista'],
  ['tasteCardAverageScore', 'Score moyen', 'Average score', 'Puntuación media'],
  ['tasteCardRated', 'Notés', 'Scored', 'Puntuados'],
  ['tasteCardTopGenres', 'Genres favoris', 'Top genres', 'Géneros favoritos'],
  ['tasteCardAffinity', '% d’affinité', '% affinity', '% de afinidad'],
  [
    'tasteCardNoGenres',
    'Pas encore assez de données.',
    'Not enough data yet.',
    'Todavía no hay suficientes datos.',
  ],
  ['tasteCardFooter', 'Réalisé avec AnimeLens', 'Made with AnimeLens', 'Hecho con AnimeLens'],
  ['tasteCardFormat', 'Format de la carte', 'Card format', 'Formato de la tarjeta'],
  ['tasteCardFormatSquare', 'Carré 1:1', 'Square 1:1', 'Cuadrada 1:1'],
  ['tasteCardFormatTall', 'Vertical 3:4', 'Tall 3:4', 'Alta 3:4'],
  ['tasteCardDownload', 'Télécharger le PNG', 'Download PNG', 'Descargar el PNG'],
  ['tasteCardCopy', 'Copier l’image', 'Copy image', 'Copiar la imagen'],
  ['tasteCardGenerating', 'Génération…', 'Generating…', 'Generando…'],
  [
    'tasteCardDownloaded',
    'Carte de goûts téléchargée.',
    'Taste card downloaded.',
    'Tarjeta de gustos descargada.',
  ],
  [
    'tasteCardCopied',
    'Carte de goûts copiée dans le presse-papiers.',
    'Taste card copied to the clipboard.',
    'Tarjeta de gustos copiada al portapapeles.',
  ],
  [
    'tasteCardCopyFailed',
    'Presse-papiers indisponible — l’image a été téléchargée à la place.',
    'Clipboard unavailable — the image was downloaded instead.',
    'Portapapeles no disponible: la imagen se ha descargado en su lugar.',
  ],
  [
    'tasteCardCopyUnsupported',
    'Copie d’images non prise en charge ici — utilisez le téléchargement.',
    'Image copy is not supported here — use the download instead.',
    'Aquí no se admite copiar imágenes: usa la descarga.',
  ],
  [
    'tasteCardRenderFailed',
    'Impossible de générer la carte de goûts. Réessayez.',
    'Could not generate the taste card. Please try again.',
    'No se ha podido generar la tarjeta de gustos. Inténtalo de nuevo.',
  ],
  ['tasteCardOptionsTitle', 'Contenu de la carte', 'Card content', 'Contenido de la tarjeta'],
  [
    'tasteCardShowGenres',
    'Afficher les genres favoris',
    'Show top genres',
    'Mostrar los géneros favoritos',
  ],
  [
    'tasteCardShowPicks',
    'Afficher les mieux notés',
    'Show top rated',
    'Mostrar los mejor puntuados',
  ],
  ['tasteCardCoverSize', 'Taille des couvertures', 'Cover size', 'Tamaño de las portadas'],
  [
    'tasteCardPicksLayout',
    'Disposition des mieux notés',
    'Top rated layout',
    'Disposición de los mejor puntuados',
  ],
  ['tasteCardLayoutList', 'Liste', 'List', 'Lista'],
  ['tasteCardLayoutGrid', 'Grille 3×3', '3×3 grid', 'Cuadrícula 3×3'],
  [
    'tasteCardGridTitle',
    'Composez votre grille 3×3',
    'Build your 3×3 grid',
    'Compón tu cuadrícula 3×3',
  ],
  ['tasteCardGridFilled', 'Remplie', 'Filled', 'Rellena'],
  [
    'tasteCardGridAllFilled',
    'Les neuf cases sont remplies.',
    'All nine boxes are filled.',
    'Las nueve casillas están rellenas.',
  ],
  ['tasteCardGridEmptyBox', 'Vider', 'Empty', 'Vaciar'],
  [
    'tasteCardGridSearch',
    'Rechercher vos anime notés',
    'Search your rated anime',
    'Busca tus animes puntuados',
  ],
  [
    'tasteCardGridNoMatches',
    'Aucun anime ne correspond à votre recherche.',
    'No anime matches your search.',
    'Ningún anime coincide con tu búsqueda.',
  ],
  ['tasteCardGridDone', 'Grille prête', 'Grid ready', 'Cuadrícula lista'],
  [
    'tasteCardGridNotPersisted',
    'Votre grille n’est pas enregistrée — à refaire la prochaine fois.',
    'Your grid is not saved — pick again next time.',
    'Tu cuadrícula no se guarda: vuelve a elegirla la próxima vez.',
  ],
  [
    'tasteCardCoverSizeCapped',
    'Plus grand en masquant une section.',
    'Larger once a section is hidden.',
    'Mayor al ocultar una sección.',
  ],
  [
    'tasteCardOptionsSaved',
    'Préférences de la carte enregistrées.',
    'Card preferences saved.',
    'Preferencias de la tarjeta guardadas.',
  ],
  [
    'tasteCardAssetFailed',
    'La carte n’a pas pu charger votre avatar. Réessayez ou déconnectez-vous.',
    'The card could not load your avatar. Please try again.',
    'La tarjeta no ha podido cargar tu avatar. Inténtalo de nuevo.',
  ],
  ['topPicksTitle', 'Choisissez votre Top 3', 'Choose your Top 3', 'Elige tu Top 3'],
  [
    'topPicksSlotLocked',
    'Rempli automatiquement',
    'Filled automatically',
    'Relleno automáticamente',
  ],
  ['topPicksSlotChosen', 'Votre choix', 'Your pick', 'Tu elección'],
  ['topPicksChosenBadge', 'Choisi', 'Chosen', 'Elegido'],
  [
    'topPicksSkipDefault',
    'Ignorer et utiliser l’ordre par défaut',
    'Skip & Use Default',
    'Omitir y usar el orden por defecto',
  ],
  [
    'topPicksDefaultHint',
    'Par défaut, le plus récemment mis à jour est retenu.',
    'By default, the most recently updated anime is used.',
    'Por defecto, se usa el anime actualizado más recientemente.',
  ],
  [
    'topPicksDefaultUsed',
    'Utilisation de l anime le plus récemment mis à jour.',
    'Used your most recently updated anime.',
    'Se ha usado tu anime actualizado más recientemente.',
  ],
  ['topPicksUpdated', 'Top 3 mis à jour.', 'Top 3 updated.', 'Top 3 actualizado.'],
  [
    'topPicksResetDone',
    'Classement réinitialisé. Choisissez à nouveau.',
    'Ranking reset. Choose again.',
    'Clasificación reiniciada. Elige de nuevo.',
  ],
  ['topPicksChange', 'Modifier mes choix', 'Change my picks', 'Cambiar mis elecciones'],
  [
    'topPicksLoadFailed',
    'Impossible de charger vos choix du Top 3.',
    'Could not load your Top 3 picks.',
    'No se han podido cargar tus elecciones del Top 3.',
  ],
  [
    'topPicksSaveFailed',
    'Impossible d’enregistrer votre Top 3.',
    'Could not save your Top 3.',
    'No se ha podido guardar tu Top 3.',
  ],
  [
    'topPicksNoCandidates',
    'Aucun candidat disponible.',
    'No candidates available.',
    'No hay candidatos disponibles.',
  ],
];

function strings(language: Language): Record<string, string> {
  return getCopy(language) as unknown as Record<string, string>;
}

const ENGLISH_WORDS = /\b(the|and|your|with|choose|is filled|not saved)\b/i;
// Accents that only French uses; Spanish has its own distinct set (á é í ó ú ñ).
const FRENCH_ONLY = /[èêëùûœç]/i;

describe('taste card copy', () => {
  it('has the right string in each language for every taste card label', () => {
    for (const [key, french, english, spanish] of TASTE_CARD_STRINGS) {
      expect(strings('fr')[key], `fr.${key}`).toBe(french);
      expect(strings('en')[key], `en.${key}`).toBe(english);
      expect(strings('es')[key], `es.${key}`).toBe(spanish);
    }
  });

  it('never leaks one language into another', () => {
    for (const [key, , , spanish] of TASTE_CARD_STRINGS) {
      const french = strings('fr')[key];
      const english = strings('en')[key];
      expect(french, key).not.toBe(english);
      expect(spanish, `es.${key}`).not.toBe(english);
      expect(spanish, `es.${key}`).not.toBe(french);
      expect(english, `en.${key}`).not.toMatch(/[éèêëàâçîïôûœ]/i);
      expect(french, `fr.${key}`).not.toMatch(ENGLISH_WORDS);
      expect(spanish, `es.${key}`).not.toMatch(ENGLISH_WORDS);
      expect(spanish, `es.${key}`).not.toMatch(FRENCH_ONLY);
    }
  });

  it('formats the count-based and slot-based labels in each language', () => {
    expect(getCopy('en').tasteCardGridSlot(3)).toBe('Box 3');
    expect(getCopy('fr').tasteCardGridSlot(3)).toBe('Case 3');
    expect(getCopy('es').tasteCardGridSlot(3)).toBe('Casilla 3');
    expect(getCopy('en').tasteCardGridIntro(4, 9)).toContain('4 of 9');
    expect(getCopy('fr').tasteCardGridIntro(4, 9)).toContain('4 sur 9');
    expect(getCopy('es').tasteCardGridIntro(4, 9)).toContain('4 de 9');
    expect(getCopy('en').tasteCardGridActive('Box 2')).toContain('Box 2');
    expect(getCopy('fr').tasteCardGridActive('Case 2')).toContain('Case 2');
    expect(getCopy('es').tasteCardGridActive('Casilla 2')).toContain('Casilla 2');
    expect(getCopy('en').tasteCardCoverSizeValue(1.5)).toBe('150%');
    expect(getCopy('fr').tasteCardCoverSizeValue(1.5)).toBe(' 150 % ');
    expect(getCopy('es').tasteCardCoverSizeValue(1.5)).toBe('150 %');
    expect(getCopy('en').topPicksSelectSlot(2)).toBe('Select your #2 anime');
    expect(getCopy('fr').topPicksSelectSlot(2)).toBe('Choisissez votre anime n°2');
    expect(getCopy('es').topPicksSelectSlot(2)).toBe('Selecciona tu anime n.º2');
    expect(getCopy('en').topPicksIntroTie(5, 9)).toContain('5 anime are tied at 9/10');
    expect(getCopy('fr').topPicksIntroTie(5, 9)).toContain('5 anime sont à égalité à 9/10');
    expect(getCopy('es').topPicksIntroTie(5, 9)).toContain('5 animes están empatados en 9/10');
    expect(getCopy('en').tasteCardIntro).toMatch(/^Download/);
    expect(getCopy('fr').tasteCardIntro).toMatch(/^Téléchargez/);
    expect(getCopy('es').tasteCardIntro).toMatch(/^Descarga/);
  });

  it('localizes the rank in profile movement sentences', () => {
    expect(getCopy('en').profileDeltaEntered('genres', 'Sci-Fi', 1)).toBe(
      'Sci-Fi joined your genres at #1.',
    );
    expect(getCopy('fr').profileDeltaEntered('genres', 'Sci-Fi', 1)).toBe(
      'Sci-Fi rejoint vos genres en 1re position.',
    );
    expect(getCopy('es').profileDeltaEntered('géneros', 'Ciencia ficción', 1)).toBe(
      'Ciencia ficción ha entrado en tus géneros en la posición 1.º.',
    );
  });
});
