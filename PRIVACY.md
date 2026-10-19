# AnimeLens privacy policy

AnimeLens is a browser extension and a desktop app. It runs entirely on your device. There is no
AnimeLens server, no account on our side, and no operator behind it.

This policy covers the Chromium build, the Firefox build, the desktop app, and the self-hosted
Docker image.

## What we collect

AnimeLens stores the following on your own device, and only when you connect a provider:

- **Provider account data.** Your account ID, username, avatar URL and join date, as returned by
  the provider's own API. On MyAnimeList the API also returns your public location and time zone; on
  AniList both are always null.
- **Your library.** The titles you have on your list, with their status, your score, episodes
  watched, rewatch flag, priority and last-updated timestamp. AnimeLens reads this to build
  recommendations; it is cached locally so the dashboard works offline.
- **Recommendation feedback.** The like / dislike / seen / not-now signals you submit, your
  optional dislike reasons, and the timestamps attached to them.
- **Taste profile.** Genre, theme, studio, staff, format and season preferences derived from your
  library and your feedback, plus snapshots of your profile taken over time.
- **OAuth credentials.** MyAnimeList and AniList access tokens, the MyAnimeList refresh token, and
  the OAuth Client IDs you enter in Settings.
- **Preferences.** Theme (dark / light / system), interface language, content-rating filter, sync
  frequency, recommendation mode, display filters, minimum compatibility score, taste-card layout
  and selected cosmetics.
- **Usage counters.** A daily streak, accumulated XP, and total time the popup was visibly open.
  A streak day is only counted after real visible time in the popup, and the counters live in your
  preferences alongside everything else.

## What we do not collect

- No analytics. No telemetry. No usage tracking.
- No crash reporting and no error reporting. Errors are written to the local browser or app console
  and are never transmitted.
- No third-party scripts, trackers, ads, pixels or fingerprinting.
- No advertising, and no data broker.
- No server-side copy of anything. Nothing is uploaded to a service we operate, because no such
  service exists.
- No passwords. No client secrets. AnimeLens never asks for either.
- No third-party runtime dependencies. The shipped bundle contains React and this project's own
  code, and nothing else.

## How your data is used

Every stored item exists to rank anime for you on your own machine. That means computing
compatibility scores, building taste clusters, generating recommendations with their explanations,
rendering your taste card, and keeping that card current.

AnimeLens does not sell your data, does not share it with advertisers, and does not build a profile
for any third party. There is no third party to share it with.

## Where your data is stored

**Extension build.** Everything lives in your browser profile:

- `chrome.storage.local` for the OAuth sessions and tokens, the cached library, feedback, the taste
  profile and its history, preferences, cosmetics, usage counters and the update check result.
- `chrome.storage.session` for the short-lived OAuth transaction state (PKCE verifier, state,
  challenge and redirect URI) and for the AniList PIN token picked up from the authorize tab. This
  area is restricted to trusted contexts and is cleared when the browser shuts down.

**Desktop build.** Everything is written to a single JSON file, `animelens-storage.json`, under the
OS user-data directory for the app. The file is stored in plain text, including the OAuth tokens.
Protect it as you would a password file.

**Self-hosted Docker image.** The desktop build runs in the container and its state lives in the
`animelens-config` volume that you create and control. The image adds no server, so requests still
leave the container directly for the providers.

The desktop build binds one listener on `127.0.0.1:8976` to receive the MyAnimeList OAuth callback.
It is loopback only unless you deliberately widen it, and nothing is forwarded anywhere from it.

## Third parties

AnimeLens contacts exactly three external services, and only for the reason given:

| Service                                                                       | Why it is contacted                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MyAnimeList (`api.myanimelist.net`, `myanimelist.net`, `cdn.myanimelist.net`) | OAuth sign-in, reading your list and profile, writing list updates, and cover images. MyAnimeList's API has no streaming-links field, so the public anime web page is read for that one card, with `credentials: 'omit'` and no `Authorization` header. |
| AniList (`graphql.anilist.co`, `anilist.co`, `s4.anilist.co`)                 | PIN authorization, GraphQL reads of your list and profile, list updates, and cover images.                                                                                                                                                              |
| GitHub (`api.github.com`)                                                     | One read-only request to the latest release, to tell you a new version exists.                                                                                                                                                                          |

Your MyAnimeList token is sent only to `api.myanimelist.net`. Your AniList token is sent only to
`graphql.anilist.co`. Neither token is ever sent to any other host, and neither is included in a
GitHub request.

You can verify all of this. The manifest lists every host the extension may reach, and the network
calls are a small, closed set of files.

## Retention

Your data persists until you remove it. There is no automatic expiry. The only things that expire on
their own are the in-memory OAuth transaction state and the AniList PIN token, which live in
`chrome.storage.session` and are discarded when the browser closes.

MyAnimeList access tokens expire on the provider's schedule and are refreshed by AnimeLens. AniList
access tokens last about a year and must be re-authorized after that.

## Your rights and deletion

Everything below is in **Settings**, and all of it happens on your device:

- **Clear cache** removes the synchronized library and the profile history, keeping your
  preferences and feedback.
- **Delete local data** erases the library, feedback, profile, profile history, preferences,
  cosmetics, client IDs, active provider and update state. You stay signed in; use the per-provider
  **Disconnect** action to remove the stored OAuth tokens as well.
- **Export data** writes a JSON file containing your feedback, preferences, active provider, manual
  top-three ranking and profile history. **Import data** reads that file back. Tokens, client IDs
  and the cached library are deliberately excluded from the export.
- **Uninstalling** the extension, or deleting the desktop build's data directory, removes
  everything it stored.

To withdraw access at the source, revoke the application directly in your
[MyAnimeList API settings](https://myanimelist.net/apiconfig) or
[AniList developer settings](https://anilist.co/settings/developer). Revoking there invalidates the
stored token everywhere.

AnimeLens is source-available under a non-commercial copyleft licence, so you can inspect every
line of the code that touches your data.

## Permissions explained

Each declared permission exists for exactly one feature.

| Permission         | Feature that needs it                                             |
| ------------------ | ----------------------------------------------------------------- |
| `storage`          | All local persistence: sessions, cache, preferences, feedback.    |
| `unlimitedStorage` | Large libraries exceed the default `storage.local` quota.         |
| `identity`         | The MyAnimeList OAuth redirect, via `chrome.identity`.            |
| `alarms`           | Scheduled library sync and the daily recommendation notification. |
| `notifications`    | The optional daily recommendation notification.                   |
| `clipboardWrite`   | Copying an exported taste card image to your clipboard.           |
| `downloads`        | Downloading an update from the GitHub release page.               |

| Host permission                 | Feature that needs it                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `https://api.myanimelist.net/*` | MyAnimeList API: library, profile, list updates.                                   |
| `https://myanimelist.net/*`     | MyAnimeList OAuth, and the public web page read for streaming links.               |
| `https://cdn.myanimelist.net/*` | MyAnimeList cover images.                                                          |
| `https://graphql.anilist.co/*`  | AniList API: library, profile, list updates.                                       |
| `https://anilist.co/*`          | AniList PIN authorization, and detecting the PIN token in the authorize tab's URL. |
| `https://s4.anilist.co/*`       | AniList cover images.                                                              |
| `https://api.github.com/*`      | The release check for update notifications.                                        |

AnimeLens does **not** request `tabs`, `scripting`, `activeTab`, `cookies`, `webRequest`,
`history`, `bookmarks`, `management`, `nativeMessaging`, `<all_urls>`, content scripts, or
web-accessible resources. It declares no content scripts at all: it never reads or modifies the
pages you visit, and it does not inject anything into MyAnimeList or AniList. The only thing it
does with a tab is read the URL AniList itself puts in the authorize tab.

## Children

AnimeLens is not directed at children under 13. It connects to adult and general-audience media
databases and is intended for adult users.

## Changes and contact

Changes to this policy are announced in the
[GitHub releases](https://github.com/Kikubay/AnimeLens/releases) for AnimeLens, alongside the
release that introduces them.

Questions about this policy: **150976767+Kikubay@users.noreply.github.com**.

---

AnimeLens is an independent project and is not affiliated with or endorsed by MyAnimeList or
AniList.
