# AnimeLens Beta

AnimeLens is a Chrome extension that analyzes your MyAnimeList activity and provides personalized anime recommendations with explanations.

This release contains only the compiled extension. You do not need the project source code or Node.js to install it.

## Install AnimeLens

1. Download the latest `AnimeLens.7z` file from the [GitHub Releases page](https://github.com/Kikubay/AnimeLens/releases).
2. Extract the ZIP file to a folder on your computer.
3. Open Google Chrome.
4. Go to:
   ```text
   chrome://extensions
   ```
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted extension folder containing `manifest.json`.

Do not select the ZIP file itself. Select the folder containing `manifest.json`.

If AnimeLens is already installed, replace the old extension files with the new release files and click **Reload** on the AnimeLens card in `chrome://extensions`.

## Configure MyAnimeList

Each computer receives its own extension ID when the extension is loaded unpacked. Therefore, each installation must use a MAL OAuth application configured for that installation.

1. Open the AnimeLens popup.
2. Open **Settings**.
3. Open **Configuration MAL**.
4. Copy the displayed **redirect URI**.
5. Open the [MyAnimeList API applications page](https://myanimelist.net/apiconfig).
6. Create a new OAuth application, or open an existing one.
7. Register the redirect URI copied from AnimeLens exactly as shown.
8. Copy the MAL **Client ID**.
9. Paste the Client ID into AnimeLens under **Client ID MAL**.
10. Click **Enregistrer le Client ID**.
11. Click **Connect MAL** from the dashboard or Settings.

The redirect URI normally looks like this:

```text
https://<your-extension-id>.chromiumapp.org/
```

The redirect URI must match exactly, including the trailing slash. Do not add a path, query string, or extra spaces.

A MAL Client Secret is not required by AnimeLens. Never enter your MAL password or Client Secret into the extension.

## Updates

AnimeLens checks GitHub for new releases whenever the popup opens. Checks are limited to once every 30 minutes to avoid repeated requests when the popup is opened and closed frequently.

When a newer version is available:

1. Click **Mettre à jour** in the AnimeLens update banner.
2. Download the latest release ZIP.
3. Extract it to a new folder, or replace the existing extension files.
4. Open `chrome://extensions`.
5. Click **Reload** on AnimeLens.

Chrome does not automatically update extensions installed with **Load unpacked**.

## Troubleshooting

### The extension does not load

- Confirm that you selected the extracted folder, not the ZIP file.
- Confirm that the selected folder contains `manifest.json`.
- Download the latest release again if files are missing.
- Open `chrome://extensions` and check the error details on the AnimeLens card.

### Settings shows an error

- Make sure you are using the latest release.
- Replace the old extension folder with the new release files.
- Click **Reload** in `chrome://extensions`.
- Close and reopen the popup.

### MAL rejects the redirect URI

- Copy the redirect URI directly from AnimeLens Settings.
- Register it in the MAL application belonging to the entered Client ID.
- Check that the extension ID is correct.
- Check the trailing slash.
- Do not add a path, query string, whitespace, or extra slash.
- Reload the extension after changing its files.

### Authentication does not finish

- Confirm that the Client ID was saved.
- Confirm that the Client ID belongs to the MAL application containing the registered redirect URI.
- Confirm that Chrome is connected to the internet.
- Check the AnimeLens service worker errors in `chrome://extensions`.
- If Chrome extension storage was cleared, configure the Client ID and connect MAL again.

### My Client ID does not work on another computer

This is expected for unpacked extensions. The other computer may have a different extension ID. Open AnimeLens Settings on that computer and register its displayed redirect URI in the corresponding MAL OAuth application.

## Privacy and security

- AnimeLens does not request or store your MAL password.
- AnimeLens does not require a MAL Client Secret.
- The MAL Client ID is public OAuth configuration.
- OAuth sessions, preferences, synchronized anime data, and recommendation feedback are stored locally in Chrome extension storage.
- Requests are made directly from the extension to MyAnimeList and GitHub.

## Release information

- Extension type: Chrome Manifest V3
- Installation method: Load unpacked
- Release downloads: [GitHub Releases](https://github.com/Kikubay/AnimeLens/releases)
