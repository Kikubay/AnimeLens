<p align="center">
  <a href="https://github.com/Kikubay/AnimeLens">
    <img alt="AnimeLens" src="https://raw.githubusercontent.com/Kikubay/AnimeLens/refs/heads/main/.github/img/icon128.png" width="120" />
  </a>
</p>
<h1 align="center">
  AnimeLens
</h1>
<h3 align="center">
  Because choosing an anime shouldn't take longer than watching it.
</h3>
<p align="center">
  AnimeLens is a privacy-first browser extension that saves anime fans hours of searching by delivering personalized, clearly explained recommendations and beautiful profile insights, securely synced across MyAnimeList and AniList. It runs on Chrome, Edge, Brave and Opera, and on Firefox.
</p>
<br>

<p align="center">
  <img alt="Animelens banner" src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Banner.png?raw=true">
</p>

<p align="center">
  <a href="https://github.com/Kikubay/AnimeLens/releases">
    <img alt="Downloads count" src="https://img.shields.io/github/downloads/Kikubay/AnimeLens/total?color=green">
  </a>
  <a href="/releases/latest">
    <img alt="GitHub release (latest)" src="https://img.shields.io/github/v/release/Kikubay/AnimeLens?label=Version&color=blue">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens/actions/">
    <img alt="CI Status" src="https://github.com/Kikubay/AnimeLens/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file">
    <img alt="License" src="https://img.shields.io/badge/License-Non--Commercial%20Copyleft-blue">
  </a>
</p>

<p align="center">
  Language: <a href="https://github.com/Kikubay/AnimeLens/blob/main/README.md">English</a> - <a href="https://github.com/Kikubay/AnimeLens/blob/main/README_fr.md">Français</a>
</p>

<br />

> _Note: Once AnimeLens launches on the Chrome Web Store and addons.mozilla.org, installation will be a single click, and the manual OAuth setup will be handled automatically in the background._

---

## 📑 Summary

- [Features](#features)
- [Showcase](#showcase)
- [Install](#install)
- [Configure](#configure)
- [Switching accounts](#switching-accounts)
- [Update](#update)
- [Troubleshooting](#troubleshooting)
- [Issues and feedback](#issues--feedback)
- [Privacy and security](#privacy-and-security)
- [License](#license)
- [Support](#support)

---

## Features

- 🎯 **Personalized Recommendations**: Get tailored anime suggestions based on your viewing history, complete with clear explanations of _why_ they were recommended.
- 🔄 **Dual-Provider Support**: Connect both **MyAnimeList** and **AniList** accounts simultaneously.
- ⚡ **Instant Account Switching**: Seamlessly switch your active provider in seconds. Your cached list remains available offline while a fresh sync runs quietly in the background.
- 📊 **Profile Analysis & Taste Cards**: Visualize your anime journey! Generate beautiful, shareable "Taste Cards" showcasing your top genres, completion stats, and highest-rated anime (with smart tie-breaking for your absolute favorites).
- 📺 **"Where to Watch"**: Open any recommendation to see which platforms stream it, with a direct link to each one.
- 🎬 **Unified "Add-to-List"**: Whether you are browsing recommendations or using quick-add features, all actions automatically target your currently active provider.
- 🔒 **Privacy-First Architecture**: AnimeLens never asks for your passwords or Client Secrets. All OAuth sessions, preferences, and synchronized data are stored securely and locally in your browser's extension storage.

---

## Showcase

> **Try it without installing anything:** [kikubay.github.io/AnimeLens](https://kikubay.github.io/AnimeLens/)
> - Runs the real interface against a sample library generated in your browser.
> - No account is connected and nothing is saved.

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Discover_GIF.gif?raw=true" width="425" alt="AnimeLens recommendations">
      <br>
      <sub><b>Personalized Recommendations</b></sub>
    </td>
    <td align="center">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Profile_GIF.gif?raw=true" width="425" alt="AnimeLens interface">
      <br>
      <sub><b>Profile analysis</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Settings_GIF.gif?raw=true" width="450" alt="AnimeLens settings">
      <br>
      <sub><b>Configuration & Settings</b></sub>
    </td>
  </tr>
</table>

---

## Install

<details>
<summary>Option 1a: Chromium (Chrome, Brave, Edge, Opera)</summary>

1. Download the latest `Animelens-<version>-chromium.zip` file from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases).
2. Extract the ZIP file to a folder on your computer.
3. Open Google Chrome, Edge, Brave or Opera.
4. Go to your browser's extensions page:

> - **Chrome / Brave:** `chrome://extensions`
> - **Edge:** `edge://extensions`
> - **Opera:** `opera://extensions`

6. Enable **Developer mode**.
7. Click **Load unpacked**.
8. Select the extracted extension folder containing `manifest.json`.

_Do not select the `ZIP` file itself. Select the folder containing `manifest.json`._

If AnimeLens is already installed, replace the old extension files with the new release files and click **Reload** on the AnimeLens card in your browser's extensions page.
</details>

<details>
<summary>Option 1b: Firefox (Standard Release - Temporary)</summary>

> Standard Firefox enforces strict extension signing. Local builds can only be loaded temporarily and **will be removed when the browser closes**.

1. Download the latest `AnimeLens-<version>-gecko.zip` from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases).
2. Extract the ZIP file to a folder on your computer.
3. Open Firefox and go to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
4. Click **Load Temporary Add-on…**.
5. Navigate to the extracted folder and select the `manifest.json` file.

> **Note:** You will need to repeat these steps every time you restart Firefox. For a permanent install on standard Firefox, wait for the official signed build to be published on [addons.mozilla.org](https://addons.mozilla.org/).

</details>

<details>
<summary>Option 1c: Firefox Developer Edition (Permanent Install)</summary>

> If you want to keep the extension permanently without waiting for the Mozilla Store release, **Firefox Developer Edition** is the most reliable and recommended method. It allows you to disable signature checks and install local builds permanently.

1. Download and install [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) (it runs independently from your standard Firefox).
2. Open a new tab, go to `about:config`, and click **Accept the Risk and Continue**.
3. Search for `xpinstall.signatures.required` and double-click it to change the value to **`false`**.
4. Download the latest `AnimeLens-<version>-gecko.zip` from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases).
5. **Rename** the downloaded `.zip` file to exactly:  
   `animelens@kikubay.github.io.xpi`  
   _(This matches the extension ID pinned in the AnimeLens build)._
6. In Firefox Developer Edition, go to `about:support` and click the **Open Folder** button next to "Profile Folder".
7. Inside that profile folder, create a new folder named `extensions` (if it does not already exist).
8. Move the renamed `animelens@kikubay.github.io.xpi` file into this `extensions` folder.
9. **Restart Firefox Developer Edition.**

The extension will now be permanently installed, fully functional, and will survive all future computer and browser restarts.
</details>

<details>
<summary>Option 1d: Desktop app</summary>

The same dashboard also ships as a desktop app for Windows, macOS and Linux. Download the installer for your platform from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases) and run it.

The desktop app talks to MyAnimeList and AniList directly and keeps your data in a local file. It is **not** code-signed, so expect a Windows SmartScreen warning on first launch.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the desktop app and the two extension builds share one codebase.
</details>

#### Option 2: Build from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/Kikubay/AnimeLens.git
   cd AnimeLens
   ```
2. Install dependencies (using your preferred package manager):
   ```bash
   npm install
   ```
3. Build the extension and the desktop app:
   ```bash
   npm run build
   ```
4. Load the generated extension output folder (`dist/chromium`) into Chrome using the steps in **Option 1**.

> `npm run build` produces all three targets. Extension output is named for the engine rather
> than the browser, because one build serves a whole family: `dist/chromium` covers Chrome, Edge,
> Brave and Opera (loadable unpacked in any of them), and `dist/gecko` is Firefox. The desktop app
> lands in `dist/electron`, where `release/` holds the installer for your platform. Build each on
> its own OS — `npm run build:extension` and `npm run build:electron` respectively.
>
> The two extension builds differ in two places: `manifest.json`, because Firefox has no background
> service worker and so runs the same bundle as an event page plus a pinned Gecko extension ID; and
> one CSS override, because Firefox's popup scrollbar takes width away from the content instead of
> overlaying it. Run `npm run build:extension:package` to produce a store-ready `.zip` for each target.

</details>

---

## Configure

<details>
<summary>MyAnimeList</summary>

- Each computer receives its own extension ID when the extension is loaded unpacked. Therefore, each installation must use a MAL OAuth application configured for that installation.

  1. Open the AnimeLens popup.
  2. Open **Settings**.
  3. Open the **MAL configuration** panel (OAuth section).
  4. Copy the displayed **redirect URI**.
  5. Open the [MyAnimeList API applications page](https://myanimelist.net/apiconfig).
  6. Create a new OAuth application, or open an existing one.
  7. Register the redirect URI copied from AnimeLens exactly as shown.
  8. Copy the MAL **Client ID**.
  9. Paste the Client ID into AnimeLens under **MAL Client ID**.
  10. Click **Save Client ID**.
  11. Click **Connect** next to MyAnimeList in the **Providers** section (or **Connect MAL** from the dashboard).

- The redirect URI is generated by the browser and differs per store. Copy whatever the
  **MAL configuration** panel shows you; the shapes are:

```text
Chromium (Chrome, Edge, Brave, Opera):  https://<extension-id>.chromiumapp.org/
Firefox:                                 https://<hash>.extensions.allizom.org/
```

On Firefox the hash is derived from the extension ID, which this build pins to
`animelens@kikubay.github.io`, so the value stays the same across reinstalls and updates.

- The redirect URI must match exactly, including the trailing slash. Do not add a path, query string, or extra spaces.
- A MAL Client Secret is not required by AnimeLens. Never enter your MAL password or Client Secret into the extension.

</details>

<details>
<summary>AniList</summary>

- AniList uses a **copy/paste authorization flow** (Auth Pin). A browser extension cannot complete AniList's token redirect inside its own auth window, so AniList displays the access token on its own site and AnimeLens picks it up from the open tab — no manual copying needed.

  1. Open the AnimeLens popup.
  2. Open **Settings**.
  3. Open the **AniList Client ID** panel (OAuth section).
  4. Note the redirect URL shown there:
     ```text
     https://anilist.co/api/v2/oauth/pin
     ```
  5. Open the [AniList developer settings](https://anilist.co/settings/developer).
  6. Click **Create New Application** (or edit an existing one).
  7. Set the **Redirect URL** to the pin URL above, exactly.
  8. Copy the AniList **Client ID**.
  9. Paste the Client ID into AnimeLens under **AniList Client ID**.
  10. Click **Save Client ID**.
  11. Click **Connect** next to AniList in the **Providers** section.
  12. AniList opens in a new tab — sign in and click **Authorize**.
  13. Return to the AnimeLens popup: a panel appears under AniList saying the authorization was detected. Click **Finish connecting**.

> An AniList Client Secret is never required. If AniList shows you a "Copy & Paste the following text" page, that is expected — leave the tab open and click **Finish connecting** in AnimeLens; the token is read automatically. You may close the popup while you authorize: AnimeLens remembers the token, so it is still there when you come back.

- AniList access tokens are long-lived (about one year). When it expires, AniList shows as disconnected and you simply authorize again.

</details>

---

## Switching accounts

Both MyAnimeList and AniList can stay connected at the same time. In **Settings → Providers**:

- Each provider card shows its status (**Active** or **Connect** / **Make active** / **Disconnect**).
- The **active** provider receives synchronization, recommendations, and add-to-list actions.
- Switching is instant: each provider keeps its own cached list, so switching back works even offline, then a fresh sync runs in the background.

---

## Update

When a newer version is available:

1. Click **Update** in the AnimeLens update banner.
2. Download the latest release ZIP for your browser.
3. Replace the existing extension files.
4. Reload the extension:
   - Chromium browsers: open `chrome://extensions` (`edge://extensions` on Edge) and click **Reload** on AnimeLens.
   - Firefox: open `about:debugging#/runtime/this-firefox`, select AnimeLens and click **Reload**.
   - Desktop app: download and run the new installer over the old one.

Browsers do not automatically update extensions installed from an unpacked folder, so this
is a manual step. A signed build installed from the Chrome Web Store or addons.mozilla.org
updates itself.

---

## Troubleshooting

<details>
<summary>The extension does not load</summary>

- Confirm that you selected the extracted folder, not the ZIP file.
- Confirm that the selected folder contains `manifest.json`.
- On Firefox, confirm you loaded `manifest.json` from **about:debugging**, and that you downloaded the Firefox package rather than the Chromium one.
- Download the latest release again if files are missing.
- Open `chrome://extensions` (or `about:debugging`) and check the error details on the AnimeLens card.

</details>

<details>
<summary>Settings shows an error</summary>

- Make sure you are using the latest release.
- Replace the old extension folder with the new release files.
- Click **Reload** in `chrome://extensions`.
- Close and reopen the popup.

</details>

<details>
<summary>MAL rejects the redirect URI</summary>

- Copy the redirect URI directly from AnimeLens Settings.
- Register it in the MAL application belonging to the entered Client ID.
- Check that the extension ID is correct.
- Check the trailing slash.
- Do not add a path, query string, whitespace, or extra slash.
- Reload the extension after changing its files.

</details>

<details>
<summary>Authentication does not finish</summary>

- Confirm that the Client ID was saved.
- Confirm that the Client ID belongs to the provider application containing the registered redirect URL.
- Confirm that Chrome is connected to the internet.
- Check the AnimeLens service worker errors in `chrome://extensions`.
- If Chrome extension storage was cleared, configure the Client ID and connect again.

</details>

<details>
<summary>AniList shows an error page after authorizing</summary>

- <code>unsupported_grant_type</code>: Update AnimeLens and reload it.
- <code>DNS address not found / chromiumapp.org</code>: the AniList application's <strong>Redirect URL</strong> is still the extension URL. Change it to <code>https://anilist.co/api/v2/oauth/pin</code> in the <a href="https://anilist.co/settings/developer">AniList developer settings</a>.
- After changing the redirect URL, reload the extension and connect again.

</details>

<details>
<summary>The AniList “Finish connecting” panel does not appear</summary>

- Keep the AniList tab open after authorizing — the token is lifted from that tab's URL.
- Make sure AniList is not already shown as connected in the Providers section.
- Reload the extension and reopen Settings; the panel polls once per second while Settings is open, and the token is remembered, so closing the popup mid-authorization is fine.
- If it still fails, disconnect AniList, click Connect again, and authorize once more.

</details>

<details>
<summary>AniList shows as disconnected</summary>

- AniList access tokens last about one year; after expiry you must authorize again (the Connect button reappears automatically).
- If you changed the AniList Client ID in Settings, the saved AniList session is cleared — connect again.

</details>

<details>
<summary>My Client ID does not work on another computer</summary>

- This is expected for unpacked extensions. The other computer may have a different extension ID.
- Open AnimeLens Settings on that computer and register its displayed redirect URI in the corresponding MAL OAuth application.

</details>

---

## Issues & Feedback

- 🐛 Found a bug ? [Open an issue](https://github.com/Kikubay/AnimeLens/issues/new?template=bug_report.md)
- 💡 Have a feature idea ? [Open a feature request](https://github.com/Kikubay/AnimeLens/issues/new?template=feature_request.md)

---

## Privacy and security

- AnimeLens does not request or store your MAL or AniList password.
- AnimeLens does not require a Client Secret for either provider.
- Client IDs are public OAuth configuration.
- AniList authorization is read from the pin-page tab URL and stored locally; it is never sent anywhere except to AniList's own API.
- OAuth sessions, preferences, synchronized anime data, and recommendation feedback are stored locally in your browser's extension storage.
- Requests are made directly from the extension to MyAnimeList, AniList, and GitHub.

---

## License

AnimeLens is licensed under a custom **non-commercial copyleft** license, based on the philosophy of the AGPL. It is free and open to inspect, study, copy, modify, and redistribute for **non-commercial** purposes, with strong copyleft obligations: derivative works must stay under the same license and must offer their complete source code, including over the network.

**Commercial use is prohibited** without explicit written permission from the copyright holder. A separate commercial license may be granted on request.

Because commercial use is restricted, this is a **source-available** license, not an OSI-approved "open source" license. See the [LICENSE](https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file) file for the full terms.

© 2026 Kikubay. All rights reserved except as expressly granted.

_Note: AnimeLens is an independent project and is not affiliated with or endorsed by MyAnimeList or AniList._

---

## Support

If AnimeLens is useful to you, consider giving the repository a ⭐. It helps other developers discover the project.
