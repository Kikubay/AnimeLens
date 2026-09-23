# AnimeLens Beta
[![Version](https://img.shields.io/github/v/release/Kikubay/AnimeLens?label=Version&color=blue)](https://github.com/Kikubay/AnimeLens/releases/latest)
![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)

![Stars](https://img.shields.io/github/stars/Kikubay/AnimeLens?style=social)
![Issues](https://img.shields.io/github/issues/Kikubay/AnimeLens?label=Open%20Issues)

![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red)

AnimeLens is a Chrome extension that analyzes your MyAnimeList activity and provides personalized anime recommendations with explanations.

This release contains only the compiled extension. You do not need the project source code or Node.js to install it.

___

## Showcase
<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/4bd55706-385b-4d0c-9f70-d96126362151" width="400" alt="AnimeLens recommendations">
      <br>
      <sub><b>Personalized Recommendations</b></sub>
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/84a472d4-74a0-44ad-9218-71d084b7ea8d" width="400" alt="AnimeLens interface">
      <br>
      <sub><b>Profile analysis</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/user-attachments/assets/f5706000-66b9-404c-9f6c-103a79df00e9" width="500" alt="AnimeLens settings">
      <br>
      <sub><b>Configuration & Settings</b></sub>
    </td>
  </tr>
</table>

___

## Install
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
  
Do not select the <b>7z</b> file itself. Select the folder containing `manifest.json`.

If AnimeLens is already installed, replace the old extension files with the new release files and click **Reload** on the AnimeLens card in `chrome://extensions`.
___

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
  10. Click **Save the Client ID**.
  11. Click **Connect MAL** from the dashboard or Settings.

The redirect URI normally looks like this:

```text
https://<your-extension-id>.chromiumapp.org/
```

The redirect URI must match exactly, including the trailing slash. Do not add a path, query string, or extra spaces.

A MAL Client Secret is not required by AnimeLens. Never enter your MAL password or Client Secret into the extension.

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
  - Confirm that the Client ID belongs to the MAL application containing the registered redirect URI.
  - Confirm that Chrome is connected to the internet.
  - Check the AnimeLens service worker errors in `chrome://extensions`.
  - If Chrome extension storage was cleared, configure the Client ID and connect MAL again.

</details>

<details>
<summary>My Client ID does not work on another computer</summary>

  - This is expected for unpacked extensions. The other computer may have a different extension ID.
  - Open AnimeLens Settings on that computer and register its displayed redirect URI in the corresponding MAL OAuth application.

</details>

___

## Issues & Feedback

- Found a bug or have an idea ? Open an [issue](https://github.com/Kikubay/AnimeLens/issues/new).

___

## Privacy and security

- AnimeLens does not request or store your MAL password.
- AnimeLens does not require a MAL Client Secret.
- The MAL Client ID is public OAuth configuration.
- OAuth sessions, preferences, synchronized anime data, and recommendation feedback are stored locally in Chrome extension storage.
- Requests are made directly from the extension to MyAnimeList and GitHub.

___

## License

The compiled releases are provided for viewing and evaluation only. No permission is granted to use, copy, modify, distribute, sublicense, or create derivative works from the software without prior written permission from the copyright holder.
See [LICENSE](https://github.com/Kikubay/AnimeLens/blob/main/LICENSE.md) for the complete terms.

___

## Support

If AnimeLens is useful to you, consider giving the repository a ⭐.
It helps other developers discover the project.

</details>
