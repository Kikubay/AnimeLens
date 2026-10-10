import type { Anime, AnimeProviderId } from '../domain/anime';
import type { AuthSnapshot } from '../auth/auth-types';
import type {
  ProviderStatusView,
  SettingsSnapshot,
  UserPreferences,
} from '../settings/settings-types';
import { DEFAULT_USER_PREFERENCES } from '../settings/settings-types';
import { createFeedback, type RecommendationFeedback } from '../domain/feedback';
import { buildDashboardRecommendationSnapshot } from '../recommendations/recommendation-dashboard';
import { buildUserPreferenceProfile } from '../recommendations/recommendation-engine';
import { profileSummaryFromModel, type ProfileSnapshot } from '../profile/profile-types';
import type { SyncMetadata } from '../domain/sync';
import type { UserProfile } from '../domain/user-profile';
import fixtureData from './data/demo-anime.json';
import { buildDemoLibrary, type DemoAnimeFixture } from './library';
import { buildRecord } from './records';
import { persistDemoProvider, readDemoProvider, readDemoSeed } from './session';
import { DEMO_DISABLED_MESSAGE, DEMO_VERSION } from './messages';

const fixtures = fixtureData.anime as readonly DemoAnimeFixture[];
const PROVIDER_DISPLAY: Readonly<Record<AnimeProviderId, string>> = {
  mal: 'MyAnimeList',
  anilist: 'AniList',
};

// A recognisable but obviously invented account, so nobody mistakes the demo for a real session.
const DEMO_USERNAME = 'demo_viewer';

interface DemoState {
  provider: AnimeProviderId;
  preferences: UserPreferences;
  feedback: RecommendationFeedback[];
  library: ReturnType<typeof buildDemoLibrary>;
  seed: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

class DemoHost {
  private readonly seed = readDemoSeed();
  private provider: AnimeProviderId = readDemoProvider();
  private preferences: UserPreferences = { ...DEFAULT_USER_PREFERENCES };
  private feedback: RecommendationFeedback[] = [];
  private library = buildDemoLibrary(fixtures, this.provider, this.seed);

  state(): DemoState {
    return {
      provider: this.provider,
      preferences: this.preferences,
      feedback: this.feedback,
      library: this.library,
      seed: this.seed,
    };
  }

  private rebuild(provider: AnimeProviderId): void {
    this.provider = provider;
    this.library = buildDemoLibrary(fixtures, provider, this.seed);
  }

  profile(): UserProfile {
    return {
      id: 1_000_000 + (this.seed % 90_000),
      username: DEMO_USERNAME,
      avatarUrl: null,
      joinedAt: '2019-04-12T00:00:00.000Z',
      location: null,
      timeZone: null,
    };
  }

  authSnapshot(): AuthSnapshot {
    return {
      status: 'authenticated',
      profile: this.profile(),
      errorCode: null,
      errorMessage: null,
    };
  }

  providers(): readonly ProviderStatusView[] {
    return (['mal', 'anilist'] as const).map((id) => ({
      id,
      displayName: PROVIDER_DISPLAY[id],
      signedIn: true,
      active: id === this.provider,
    }));
  }

  settingsSnapshot(): SettingsSnapshot {
    return {
      preferences: this.preferences,
      auth: this.authSnapshot(),
      providers: this.providers(),
      malClientId: '',
      anilistClientId: '',
      malRedirectUri: 'chrome-extension://demo/',
      anilistRedirectUri: 'https://anilist.co/api/v2/oauth/pin',
    };
  }

  syncMetadata(): SyncMetadata {
    return {
      status: 'success',
      phase: 'complete',
      progress: null,
      lastSyncedAt: nowIso(),
      itemCount: this.library.watched.length,
      nextPageUrl: null,
      errorCode: null,
      errorMessage: null,
      fromCache: false,
    };
  }

  updatePreferences(preferences: UserPreferences): SettingsSnapshot {
    this.preferences = preferences;
    return this.settingsSnapshot();
  }

  setActiveProvider(provider: AnimeProviderId): AuthSnapshot {
    this.rebuild(provider);
    // The Settings tab drives this switch, so the choice is remembered for the next reload.
    persistDemoProvider(provider);
    return this.authSnapshot();
  }

  profileSnapshot(language: 'en' | 'fr'): ProfileSnapshot {
    const model = buildUserPreferenceProfile(this.library.watched, this.feedback);
    return {
      status: 'ready',
      summary: profileSummaryFromModel(model, language, this.library.watched, this.provider),
      // A demo has no history to compare against, and the UI copes with a missing baseline.
      delta: null,
      errorMessage: null,
    };
  }

  search(query: string): readonly Anime[] {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return fixtures
      .filter((fixture) => {
        const titles = [fixture.title.default, fixture.title.english, fixture.title.japanese];
        return titles.some(
          (title) => typeof title === 'string' && title.toLowerCase().includes(needle),
        );
      })
      .slice(0, 20)
      .map((fixture) => buildRecord(fixture, this.provider));
  }

  recordFor(animeId: number): Anime | null {
    const fixture = fixtures.find((candidate) =>
      this.provider === 'anilist' ? candidate.id === animeId : candidate.malId === animeId,
    );
    return fixture === undefined ? null : buildRecord(fixture, this.provider);
  }

  addFeedback(
    recommendationId: string,
    anime: Anime,
    value: RecommendationFeedback['value'],
    reasons: RecommendationFeedback['reasons'],
  ): readonly RecommendationFeedback[] {
    const existing = this.feedback.findIndex((item) => item.animeMalId === anime.id);
    const next =
      existing >= 0 ? this.feedback.filter((_, index) => index !== existing) : this.feedback;
    next.push(createFeedback(recommendationId, anime, value, nowIso(), { reasons }));
    this.feedback = next;
    return this.feedback;
  }

  async dashboard() {
    return buildDashboardRecommendationSnapshot(
      this.library.watched,
      this.syncMetadata(),
      this.preferences,
      this.feedback,
      nowIso(),
      async () => this.library.candidates,
    );
  }
}

export const demoHost = new DemoHost();
export { DEMO_DISABLED_MESSAGE, DEMO_VERSION };
