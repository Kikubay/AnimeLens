# Contributing to AnimeLens

Thanks for your interest in improving AnimeLens! This document covers how to set
up a development environment, the conventions the codebase follows, and what to
expect when you open a pull request.

New to the project? Issues labelled `good first issue` are a good place to start
when any are open. If the list is empty, ask — there is usually a small,
self-contained task we can hand you.

## Table of contents

- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Running the checks](#running-the-checks)
- [Project layout](#project-layout)
- [The three build targets](#the-three-build-targets)
- [Code style](#code-style)
- [Adding a user-facing string](#adding-a-user-facing-string)
- [Testing](#testing)
- [Commit message format](#commit-message-format)
- [Pull requests](#pull-requests)
- [Reporting bugs](#reporting-bugs)
- [Contributor license](#contributor-license)

## Before you start

### Licensing — please read this first

AnimeLens is **not** released under an OSI-approved open source license. It uses a
custom [AnimeLens Non-Commercial License](LICENSE.md), which means:

- You **may** use, study, modify, and redistribute the code.
- You **may not** use AnimeLens or a derivative of it for commercial purposes.
- Public releases **must** credit Kikubay and link back to the repository.
- Modified versions **may not** be published on the Chrome Web Store or any other
  extension marketplace under the name "AnimeLens".

By contributing, you agree that your work is licensed under these same terms. If
that is not acceptable for you or your employer, please open an issue before
starting so we can discuss it.

### Provider API access

AnimeLens talks to MyAnimeList and AniList. Neither requires an API key to read
public data, but connecting a personal account does require registering your own
OAuth application. See [Development setup](#development-setup) below.

AnimeLens is an independent project and is **not** affiliated with or endorsed by
MyAnimeList or AniList. Please do not open issues against them on our behalf.

## Development setup

### Prerequisites

| Tool       | Version  | Notes                                             |
| ---------- | -------- | ------------------------------------------------- |
| Node.js    | 20 or 22 | Use the current LTS.                              |
| npm        | 10+      | Any package manager works; the commands below are npm. |
| Chromium browser | 100+ | Manifest V3 is required. Chrome, Edge, Brave and Opera all work. |
| Firefox    | 128+     | Needed to load `dist/gecko`. Anything older refuses the manifest. |
| Git        | any      | Required to clone.                                 |

### Install and run

```bash
git clone https://github.com/Kikubay/AnimeLens.git
cd AnimeLens
npm install
npm run dev
```

### Loading the extension in a Chromium browser

The manifest lives in `public/` and Vite copies it into `dist/chromium` at build time, so
the folder to load is always the build output — not the repository root.

```bash
npm run build:extension   # or just `npm run build`, which also builds the app
```

Then in Chrome, Edge, Brave or Opera:

1. Open `chrome://extensions` (`edge://extensions` on Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the **`dist/chromium`** folder (the one containing `manifest.json`).

Re-run the build after each change and press **Reload** on the AnimeLens card. Browsers do
not hot-reload unpacked extensions, so this rebuild-and-reload cycle is the normal inner loop.

`npm run dev` starts Vite with hot module replacement for the React UI, which speeds up
iteration once `dist/chromium` is already loaded. Because the manifest and the background
script are copied at build time, changes to those still require the rebuild above.

### Loading the extension in Firefox

Firefox needs its own build: it has no background service worker, so `dist/chromium` will
not run there.

```bash
npm run build:extension:gecko
```

Then in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the **`dist/gecko`** folder's `manifest.json`.

Temporary add-ons disappear when Firefox closes, which is fine for development.

> **Unpacked extension IDs differ per machine on Chromium browsers.** Chrome assigns a new
> extension ID for each installation, so the OAuth redirect URI shown in Settings will not
> match on another computer. Register a separate OAuth application per install you use for
> development, or expect to reconfigure after switching machines. Firefox is the exception:
> this build pins its extension ID in `browser_specific_settings.gecko.id`, so its redirect
> URI is stable everywhere.

### Packaging for the stores

```bash
npm run build:extension:package
```

This writes a `.zip` per target under `dist/chromium/release` and `dist/gecko/release`,
with `manifest.json` at the archive root as both the Chrome Web Store and AMO require.

### Running the desktop app

`npm run build` also produces an installable desktop app, built by
[electron-builder](https://www.electron.build):

```bash
npm run build          # extension + desktop app
npm run build:electron # desktop app only
npm run start:electron # run the unpacked build without installing it
```

Output lands in `dist/electron`:

| Path                    | Contents                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `app/`                  | The unpacked app: `main.mjs`, `preload.mjs`, `background.mjs`, `renderer/`. |
| `release/`              | The installer and the unpacked tree electron-builder produced. |

On Windows that means `release/AnimeLens-<version>-x64.exe`. Packaging only
produces artifacts for the platform you build on, so a macOS `.dmg` or a Linux
`AppImage` has to be built on that OS.

> **Desktop builds are not code-signed.** Windows SmartScreen will warn on first
> launch. That is expected for an unsigned build and not a packaging bug.

See [below](#the-three-build-targets) for how the three targets share one codebase.

### Environment variables

Copy `.env.example` to `.env.development` and fill in what you need:

```bash
cp .env.example .env.development
```

| Variable                 | Required            | Purpose                                                                 |
| ------------------------ | ------------------- | ----------------------------------------------------------------------- |
| `VITE_APP_ENV`           | no                  | Build label, defaults to the Vite mode.                                  |
| `VITE_MAL_CLIENT_ID`     | for MAL sign-in     | Public MAL OAuth client ID. Leave blank to configure it inside the UI.   |
| `VITE_ANILIST_CLIENT_ID` | for AniList sign-in | Public AniList client ID. Leave blank to configure it inside the UI.      |

**Never commit API secrets.** AnimeLens does not use client secrets, and it never
asks for your MAL or AniList password. Client IDs are public configuration.
Anything prefixed with `VITE_` is inlined into the built bundle and is readable
by anyone who installs the extension — treat those values as public.

You can also skip the environment entirely and enter client IDs in
**Settings → Configuration** at runtime, which is usually easier for local work.

## Running the checks

```bash
npm run lint       # ESLint, including react-hooks rules
npm run typecheck  # tsc --noEmit
npm test           # Vitest, single run
npm run build      # typecheck, then the extension and the desktop app
npm run format     # Prettier, writing changes
```

All four checks — `lint`, `typecheck`, `test` and `build` — should pass before you open a
pull request. `npm run build` runs `typecheck` itself, so it covers the TypeScript check.

To re-run tests as you edit:

```bash
npx vitest        # watch mode
npx vitest tests/recommendation-engine.test.ts   # a single file
```

## Project layout

| Directory          | Responsibility                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| `src/domain`       | Pure data types and invariants. No I/O, no browser APIs.                       |
| `src/api`          | Provider implementations: MyAnimeList, AniList, and a mock provider for tests.   |
| `src/auth`         | OAuth flows, session storage, and PKCE. Never handles client secrets.          |
| `src/storage`      | Thin wrappers over `chrome.storage`.                                           |
| `src/sync`         | List synchronization and its on-disk cache.                                    |
| `src/recommendations` | The recommendation engine and dashboard assembly.                          |
| `src/profile`      | Profile summaries, taste-card modelling, and top-picks ranking.                |
| `src/feedback`     | Per-anime like/dislike signals.                                                 |
| `src/settings`     | Preferences, themes, and persisted settings.                                    |
| `src/updates`      | GitHub release checking.                                                        |
| `src/popup`        | The React UI: pages, components, and the taste-card canvas painter.             |
| `src/locales`      | All user-facing text. See [below](#adding-a-user-facing-string).                |
| `src/background`   | The MV3 service worker that owns all message handling.                          |
| `src/platform`     | Target wiring that all builds share. See [below](#the-three-build-targets).      |
| `electron`         | The desktop shell: main process, preload, and the `chrome.*` adapter.           |
| `src/providers`    | The provider registry that ties the above together.                             |

Two structural rules matter:

- **The service worker is the only place that talks to providers.** The popup
  sends messages; it does not call provider APIs directly. Keep new I/O behind a
  message handler in `src/background/service-worker.ts`.
- **`src/domain` stays pure.** If a module in `src/domain` needs `fetch` or
  `chrome`, it belongs somewhere else.

## The three build targets

AnimeLens ships as a Chromium extension, a Firefox extension and a desktop app from one
codebase. They are not three implementations — the extension's background script *is* the
Electron main process.

| Concern     | Extension                            | Desktop                                                    |
| ----------- | ------------------------------------ | ---------------------------------------------------------- |
| Background  | MV3 service worker (Chromium), MV3 event page (Firefox) | Electron main process                        |
| UI          | Popup document                       | `BrowserWindow` over `app://animelens`                     |
| Messaging   | `chrome.runtime.sendMessage`         | The same message types, routed over `ipcMain`              |
| Storage     | `chrome.storage`                     | JSON file in `app.getPath('userData')`                     |
| Scheduling  | `chrome.alarms`                      | Persisted timers                                           |
| OAuth       | `chrome.identity.launchWebAuthFlow`  | Loopback HTTP server + the system browser                  |

The two extension builds compile the same sources and differ only where the platforms
force it. `vite.manifest.ts` generates the manifest per target, and
`geckoScrollbarPlugin` adds the one CSS override Firefox needs; everything else is
identical.

| Difference | Why it exists |
| ---------- | ------------- |
| `background.scripts` instead of `background.service_worker` | Firefox does not support background service workers at all. |
| `browser_specific_settings.gecko` | AMO requires an explicit extension ID to sign MV3, and Firefox derives its OAuth redirect host from it. |
| A hidden popup scrollbar | Firefox's scrollbar takes layout width instead of overlaying, which would force a horizontal scrollbar. |

Keep this list short. A difference that can be handled with a feature check or an optional
call belongs in the code, not in the build.

The rules that keep this working:

- **Never branch on the host inside `src/`.** Add to the adapter instead
  (`electron/shim/`). The only shared-module exception is
  `src/platform/desktop-bridge.ts`, which installs the preload bridge and is a
  no-op in the extension.
- **`electron/main.ts` must import `background.mjs` dynamically**, after the
  `chrome.*` adapter is installed. The service worker registers its message
  handler at module-evaluation time.
- **The preload exposes `window.__animelens`, not `window.chrome`.** Chromium
  already owns the `chrome` name in every renderer and `contextBridge` will not
  overwrite it.
- **Never add a `chrome.*` call the adapter does not implement.** The shim only
  provides what the extension actually uses, so a new call fails loudly instead
  of silently resolving `undefined`.

Two behaviours differ by design, because the desktop host genuinely cannot
reproduce them:

- **AniList sign-in needs the token pasted on the desktop.** The consent page
  opens in the user's own browser, so the app cannot read the callback URL the
  way an extension can from a browser tab. The pin panel therefore carries a token field on
  all three targets: the extension fills it automatically when it spots the redirect
  tab, and the user can type or overwrite it at any time. Auto-detect is the
  fast path, not the only path — never gate the submit button on detection.
- **MAL sign-in needs `http://127.0.0.1:8976/` registered** as the redirect URI
  on the MAL developer app, because that is the loopback address the desktop
  sign-in server listens on.

## Code style

Formatting is handled by Prettier (`printWidth: 100`, single quotes, semicolons,
trailing commas). Run `npm run format` rather than hand-tuning whitespace.

Beyond formatting:

- **Type imports must use `import type`.** This is an enforced ESLint rule.
- **Exported functions and components are documented** with a short comment
  explaining *why*, not restating the signature. Prefer a single-line `//`
  comment where a full doc block would be noise.
- **Underscore-prefixed unused parameters** are allowed (`_arg`).
- **Prefer pure functions.** Most of the codebase is pure functions over domain
  types, which is what makes it straightforward to test.
- **Do not add dependencies casually.** The extension ships React and almost
  nothing else. A new runtime dependency is a real cost for users; propose it in
  an issue first.

## Adding a user-facing string

All user-facing text lives in `src/locales`. **Never hardcode a string that a
user can read**, including in error messages, canvas drawing, and accessibility
labels.

1. Add the key to the `AppCopy` interface in `src/locales/schema.ts`. Give it a
   signature that reflects its arguments, for example
   `readonly titles: (count: number) => string;`.
2. If the message takes arguments, add a matching entry to `MESSAGE_PARAMS` in
   the same file, listing the placeholder names in the same order. Omitting this
   is a compile error, by design.
3. Add the template to **both** `src/locales/en.json` and `src/locales/fr.json`.
   Use `{name}` placeholders, for example `"Titles: {count}"`. A key missing from
   either file is a compile error.
4. Use it as `copy.myKey` (plain string) or `copy.myKey(arg)` (templated).

Two constraints the build enforces for you:

- Both locale files must contain exactly the same keys, or `tsc` fails.
- Every template must use exactly the placeholders declared in `MESSAGE_PARAMS`,
  checked by the `locale-parity` tests.

Templates are free to reorder or repeat placeholders, so write them in the order
the language naturally needs rather than translating English word-for-word. For
an argument that needs transforming before substitution (scaling, lowercasing, a
nullable fallback), add an entry to `ARGUMENT_TRANSFORMS` in
`src/locales/index.ts` and document why.

If your message needs logic the templates cannot express, that logic belongs in
`ARGUMENT_TRANSFORMS` — not in the JSON.

## Testing

Tests live in `tests/` and use [Vitest](https://vitest.dev). There are no
browser-based tests; the suite runs in Node, so favour pure-function tests over
DOM tests and stub `chrome` APIs directly (see `tests/auth-store.test.ts` for the
established pattern).

```bash
npm test                                  # everything
npx vitest tests/top-picks.test.ts        # one file
npx vitest -t "tie-break"                 # by test name
```

When you change behaviour:

- **Add or update a test.** Bug fixes should come with a failing test that your
  fix makes pass.
- **Name tests after the behaviour**, not the function: `it('prefers the
  tie-break pick over the default', ...)` rather than `it('test applyManualRanking')`.
- **Cover the edges**: empty inputs, single-element lists, ties, null fields.
- **Do not weaken an existing test to make your change pass.** If a test now
  encodes the wrong behaviour, say so explicitly in the pull request.

The `locale-parity` and `i18n` suites protect the localization surface. If you
touch `src/locales`, expect them to fail when key sets or placeholders drift.

## Commit message format

The project uses [Conventional Commits](https://www.conventionalcommits.org/).
There is no pre-existing history to match, so this convention starts with the
first commit.

```
<type>(<optional scope>): <imperative summary>
```

The summary is written in the imperative mood ("add", not "added" or "adds"), is
not capitalised, and does not end with a period. Keep it under 72 characters.

### Types

| Type       | Use for                                                        |
| ---------- | -------------------------------------------------------------- |
| `feat`     | A new user-visible capability.                                  |
| `fix`      | A bug fix.                                                      |
| `docs`     | Documentation only.                                             |
| `refactor` | Behaviour-preserving restructuring.                             |
| `perf`     | A measurable performance improvement.                           |
| `test`     | Adding or correcting tests.                                     |
| `build`    | Build tooling, dependencies, or config.                         |
| `ci`       | CI configuration.                                               |
| `chore`    | Maintenance that fits nowhere else.                             |

Useful scopes include `recommendations`, `sync`, `auth`, `popup`, `locales`,
`taste-card`, and `settings`. Use a scope only when it narrows the change
usefully.

### Examples

```
feat(recommendations): weight recent feedback more heavily
fix(locales): keep French spacing in the cover size label
docs: document the OAuth redirect URI per machine
refactor(auth): extract the PKCE verifier generation
test(top-picks): cover the three-way tie
```

### Optional footer

A breaking change requires a `!` after the scope or type, plus an explanation:

```
feat(sync)!: switch the cache format to a versioned envelope

Older cached lists are discarded on upgrade rather than migrated.
```

Because this extension updates in place, a `!` in a commit does not itself create
a semver bump — version bumps happen in `package.json` and `public/manifest.json`
at release time. Treat `!` as a signal for reviewers, not a release mechanism.

## Pull requests

1. **Open an issue first** for anything substantial, so the approach can be
   agreed on before you write the code. Bug reports and small fixes can go
   straight to a PR.
2. **Branch from `main`** with a descriptive name, such as
   `fix/anilist-token-expiry` or `feat/genre-exclusions`.
3. **Keep the change focused.** One concern per pull request. Unrelated
   reformatting makes review harder and will be asked to move to a separate PR.
4. **Make sure `npm run lint`, `npm run typecheck`, and `npm test` all pass.**
5. **Write a description** covering what changed, why, and how you verified it.
   Include a before/after screenshot for UI changes.
6. **Note any localization impact.** If your change adds or alters user-facing
   text, say which keys you touched.

You do not need to update the version in `package.json` or `manifest.json` —
the maintainer does that at release time.

Please be patient with review. Comments are about the code, not about you.

## Reporting bugs

Use the bug report template if one is offered in the issue picker, or open a
plain issue. Either way, it is much easier to help when a report includes:

- Your browser and version, plus your OS. Name the browser explicitly: the Chromium and
  Firefox builds differ.
- The AnimeLens version, shown in **Settings**.
- The background console output: `chrome://extensions` → AnimeLens → Service worker on
  Chromium browsers, or `about:debugging` → AnimeLens → Inspect on Firefox.
- Exact steps to reproduce, and what you expected instead.

**Never include your access tokens, client secrets, or personal list data** in
an issue or log. If a log contains a token, revoke it by disconnecting the
account in Settings.

## Contributor license

By submitting a pull request you agree that your contribution is licensed under
the [AnimeLens Non-Commercial License](LICENSE.md) that covers this repository.

If you are contributing on behalf of an employer, check that your employment
agreement allows contributing under these terms before opening the pull request.
