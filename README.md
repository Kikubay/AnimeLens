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
  AnimeLens is a privacy-first Chrome extension that saves anime fans hours of searching by delivering personalized, clearly explained recommendations and beautiful profile insights, securely synced across MyAnimeList and AniList.
</p>
<br>

<p align="center">
  <img alt="Animelens banner" src="https://github.com/user-attachments/assets/7ea21f73-e67f-43e1-a69b-71a9f1de4695">
</p>

<p align="center">
  <a href="https://github.com/Kikubay/AnimeLens/releases">
    <img alt="Downloads count" src="https://img.shields.io/github/downloads/Kikubay/AnimeLens/total?color=green">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens/releases/latest">
    <img alt="GitHub release (latest)" src="https://img.shields.io/github/v/release/Kikubay/AnimeLens?label=Version&color=blue">
  </a>
  <a href="https://chromewebstore.google.com/">
    <img alt="Soon" src="https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file">
    <img alt="License" src="https://img.shields.io/badge/License-All%20Rights%20Reserved-red">
  </a>
</p>
<br />

> 🎉 **The source code is now public!** 
> You can now explore, build, and contribute to the project directly from this repository. 
> 
> *Note: Once AnimeLens launches on the Chrome Web Store, installation will be a single click, and the manual OAuth setup will be handled automatically in the background.*

___

## 📑 Summary

- [Features](#features)
- [Showcase](#showcase)
- [Install](#install)
- [Configure](#configure)
- [Switching accounts](#switching-accounts)
- [Update](#update)
- [Troubleshooting](#troubleshooting)
- [Privacy and security](#privacy-and-security)
- [Issues and feedback](#issues--feedback)
- [License](#license)

___

## Features

- 🎯 **Personalized Recommendations**: Get tailored anime suggestions based on your viewing history, complete with clear explanations of *why* they were recommended.
- 🔄 **Dual-Provider Support**: Connect both **MyAnimeList** and **AniList** accounts simultaneously. 
- ⚡ **Instant Account Switching**: Seamlessly switch your active provider in seconds. Your cached list remains available offline while a fresh sync runs quietly in the background.
- 📊 **Profile Analysis & Taste Cards**: Visualize your anime journey! Generate beautiful, shareable "Taste Cards" showcasing your top genres, completion stats, and highest-rated anime (with smart tie-breaking for your absolute favorites).
- 🎬 **Unified "Add-to-List"**: Whether you are browsing recommendations or using quick-add features, all actions automatically target your currently active provider.
- 🔒 **Privacy-First Architecture**: AnimeLens never asks for your passwords or Client Secrets. All OAuth sessions, preferences, and synchronized data are stored securely and locally in your Chrome extension storage.

___

## Showcase

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/9eb42caf-6775-4b42-aa10-c4a551d4a6b3" width="500" style="max-width: 100%; height: auto;" alt="AnimeLens recommendations">
      <br>
      <sub><b>Personalized Recommendations</b></sub>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/65619f49-990b-406c-9d78-ff66efeb757f" width="500" style="max-width: 100%; height: auto;" alt="AnimeLens interface">
      <br>
      <sub><b>Profile analysis</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/user-attachments/assets/6622eed5-0616-4275-b878-85caec58e1ca" width="500" style="max-width: 100%; height: auto;" alt="AnimeLens settings">
      <br>
      <sub><b>Configuration & Settings</b></sub>
    </td>
  </tr>
</table>

___

## Install

### Option 1: Pre-compiled Release (Recommended)
1. Download the latest `AnimeLens.7z` file from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases).
2. Extract the 7z file to a folder on your computer.
3. Open Google Chrome.
4. Go to:
   ```text
   chrome://extensions
   ```
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted extension folder containing `manifest.json`.

*Do not select the `7z` file itself. Select the folder containing `manifest.json`.*

If AnimeLens is already installed, replace the old extension files with the new release files and click **Reload** on the AnimeLens card in `chrome://extensions`.

### Option 2: Build from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/Kikubay/AnimeLens.git
   cd AnimeLens
   ```
2. Install dependencies (using your preferred package manager):
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the generated output folder (`dist`) into Chrome using the steps in **Option 1**.

___

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

- The redirect URI normally looks like this:

```text
https://<your-extension-id>.chromiumapp.org/
```

- The redirect URI must match exactly, including the trailing slash. Do not add a path, query string, or extra spaces.
- A MAL Client Secret is not required by AnimeLens. Never enter your MAL password or Client Secret into the extension.
</details>

<details>
<summary>AniList</summary>

- AniList uses a **copy/paste authorization flow** (Auth Pin). Chrome cannot complete AniList's token redirect inside the extension's auth window, so AniList displays the access token on its own site and the extension picks it up from the open tab — no manual copying needed.

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

> An AniList Client Secret is never required. If AniList shows you a "Copy & Paste the following text" page, that is expected — leave the tab open and click **Finish connecting** in AnimeLens; the token is read automatically.

- AniList access tokens are long-lived (about one year). When it expires, AniList shows as disconnected and you simply authorize again.
</details>

___

## Switching accounts

Both MyAnimeList and AniList can stay connected at the same time. In **Settings → Providers**:

- Each provider card shows its status (**Active** or **Connect** / **Make active** / **Disconnect**).
- The **active** provider receives synchronization, recommendations, and add-to-list actions.
- Switching is instant: each provider keeps its own cached list, so switching back works even offline, then a fresh sync runs in the background.

___

## Update

When a newer version is available:

1. Click **Update** in the AnimeLens update banner.
2. Download the latest release 7z.
3. Extract it to a new folder, or replace the existing extension files.
4. Open `chrome://extensions`.
5. Click **Reload** on AnimeLens.

Chrome does not automatically update extensions installed with **Load unpacked**.

___

## Troubleshooting

<details>
<summary>The extension does not load</summary>

  - Confirm that you selected the extracted folder, not the 7z file.
  - Confirm that the selected folder contains `manifest.json`.
  - Download the latest release again if files are missing.
  - Open `chrome://extensions` and check the error details on the AnimeLens card.

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

  - Keep the AniList tab open after authorizing — the panel only shows while that tab is open.
  - Make sure AniList is not already shown as connected in the Providers section.
  - Reload the extension and reopen Settings; the detection polls once per second while Settings is open.
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

___

## Issues & Feedback

- 🐛 Found a bug ? [Open an issue](https://github.com/Kikubay/AnimeLens/issues/new?template=bug_report.md)
- 💡 Have a feature idea ? [Open a feature request](https://github.com/Kikubay/AnimeLens/issues/new?template=feature_request.md)

___

## Privacy and security

- AnimeLens does not request or store your MAL or AniList password.
- AnimeLens does not require a Client Secret for either provider.
- Client IDs are public OAuth configuration.
- AniList authorization is read from the pin-page tab URL and stored locally; it is never sent anywhere except to AniList's own API.
- OAuth sessions, preferences, synchronized anime data, and recommendation feedback are stored locally in Chrome extension storage.
- Requests are made directly from the extension to MyAnimeList, AniList, and GitHub.

___

## License

The source code for AnimeLens is now publicly available in this repository. 

**All Rights Reserved.** 
The compiled releases of AnimeLens are provided for personal evaluation only. You may not use, copy, modify, distribute, or create derivative works from the *compiled software* without explicit written permission from the copyright holder. 

*(Developer Note: If you are transitioning this project to a standard open-source license like MIT or GPL, please replace this section with the appropriate license text and update the badge at the top of the README.)*

See the [LICENSE](https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file) file for full details.

*Note: AnimeLens is an independent project and is not affiliated with or endorsed by MyAnimeList or AniList.*

___

## Support

If AnimeLens is useful to you, consider giving the repository a ⭐. It helps other developers discover the project.
