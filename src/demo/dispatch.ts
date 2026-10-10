import type { AnimeProviderId } from '../domain/anime';
import { normalizeUserPreferences } from '../settings/settings-types';
import type { UserPreferences } from '../settings/settings-types';
import { normalizeLanguage } from '../locales';
import { demoHost } from './host';
import { DEMO_DISABLED_MESSAGE, DEMO_VERSION } from './messages';

type Message = { readonly type?: unknown } & Record<string, unknown>;

const ok = <T extends Record<string, unknown>>(payload: T) => ({ ok: true, ...payload });
const fail = (message: string) => ({ ok: false, message });

function isProviderId(value: unknown): value is AnimeProviderId {
  return value === 'mal' || value === 'anilist';
}

function preferencesOf(message: Message): UserPreferences {
  return normalizeUserPreferences(message.preferences);
}

/**
 * The popup only ever reaches its background through `chrome.runtime.sendMessage`, so a
 * single function backing that call is enough to host the whole app in a plain tab. Anything
 * that would touch a real account or a real provider API answers with a refusal instead.
 */
export async function dispatchDemoMessage(message: unknown): Promise<unknown> {
  if (typeof message !== 'object' || message === null) return undefined;
  const request = message as Message;

  switch (request.type) {
    case 'auth.get_snapshot':
      return ok({ snapshot: demoHost.authSnapshot() });
    case 'auth.get_providers':
      return ok({ providers: demoHost.providers() });
    case 'auth.set_active_provider':
      if (!isProviderId(request.providerId)) return fail('Unknown provider.');
      return ok({ snapshot: demoHost.setActiveProvider(request.providerId) });
    case 'auth.get_token_exchange_diagnostic':
      return ok({ diagnostic: null });
    // The pin flow would open AniList's authorize page, so it is refused outright.
    case 'auth.get_pin_token':
      return ok({ pinToken: null });
    case 'auth.connect':
    case 'auth.disconnect':
    case 'auth.complete_pin_connect':
      return fail(DEMO_DISABLED_MESSAGE);

    case 'settings.get_snapshot':
      return ok({ snapshot: demoHost.settingsSnapshot() });
    case 'settings.update_preferences':
      return ok({ snapshot: demoHost.updatePreferences(preferencesOf(request)) });
    case 'settings.update_mal_client_id':
    case 'settings.update_anilist_client_id':
    case 'settings.clear_cache':
    case 'settings.delete_local_data':
    case 'settings.disconnect_mal':
      return fail(DEMO_DISABLED_MESSAGE);

    case 'sync.get_snapshot':
      return ok({ snapshot: { metadata: demoHost.syncMetadata(), progress: null } });
    case 'sync.start':
      return ok({ snapshot: { metadata: demoHost.syncMetadata(), progress: null } });
    case 'sync.invalidate':
      return ok({});

    case 'recommendations.get_dashboard':
      return ok({ snapshot: await demoHost.dashboard() });

    case 'profile.get_snapshot':
      return ok({ snapshot: demoHost.profileSnapshot(currentLanguage()) });
    case 'profile.clear_history':
      return ok({ snapshot: demoHost.profileSnapshot(currentLanguage()) });
    case 'profile.get_top_picks_ranking':
      return ok({ ranking: null });
    case 'profile.save_top_picks_ranking':
    case 'profile.clear_top_picks_ranking':
      return ok({});

    case 'feedback.submit':
      if (typeof request.recommendationId !== 'string') return fail('Invalid feedback.');
      return ok({
        feedback: demoHost.addFeedback(
          request.recommendationId,
          request.anime as Parameters<typeof demoHost.addFeedback>[1],
          request.value as Parameters<typeof demoHost.addFeedback>[2],
          request.reasons as Parameters<typeof demoHost.addFeedback>[3],
        ),
      });
    case 'feedback.list':
      return ok({ feedback: demoHost.state().feedback });

    case 'anime.search':
      if (typeof request.query !== 'string') return fail('Invalid search.');
      return ok({ results: demoHost.search(request.query) });

    case 'anime.get_streaming_links': {
      const record = demoHost.recordFor(Number(request.animeId));
      // The record already carries its links, so there is nothing further to fetch.
      return ok({ links: record?.streamingSites ?? [] });
    }

    case 'mal.list.add':
      return fail(DEMO_DISABLED_MESSAGE);

    case 'updates.check':
      return ok({
        snapshot: {
          status: 'up_to_date',
          currentVersion: DEMO_VERSION,
          latestVersion: DEMO_VERSION,
          releaseUrl: null,
          downloadUrl: null,
          checkedAt: Date.now(),
        },
      });

    default:
      return undefined;
  }
}

function currentLanguage(): 'en' | 'fr' {
  return normalizeLanguage(demoHost.state().preferences.language);
}
