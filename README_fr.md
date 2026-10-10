<p align="center">
  <a href="https://github.com/Kikubay/AnimeLens">
    <img alt="AnimeLens" src="https://raw.githubusercontent.com/Kikubay/AnimeLens/refs/heads/main/.github/img/icon128.png" width="120" />
  </a>
</p>
<h1 align="center">
  AnimeLens
</h1>
<h3 align="center">
  Parce que choisir un animé ne devrait pas prendre plus de temps que le regarder.
</h3>
<p align="center">
  AnimeLens est une extension de navigateur respectueuse de la vie privée qui fait gagner des heures de recherche aux fans d'animés en leur proposant des recommandations personnalisées et clairement expliquées, ainsi que de magnifiques aperçus de profil, le tout synchronisé en toute sécurité entre MyAnimeList et AniList. Elle fonctionne sur Chrome, Edge, Brave et Opera, ainsi que sur Firefox.
</p>
<br>

<p align="center">
  <img alt="Bannière AnimeLens" src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Banner.png?raw=true">
</p>

<p align="center">
  <a href="https://github.com/Kikubay/AnimeLens/releases">
    <img alt="Nombre de téléchargements" src="https://img.shields.io/github/downloads/Kikubay/AnimeLens/total?color=green">
  </a>
  <a href="/releases/latest">
    <img alt="Version GitHub (dernière)" src="https://img.shields.io/github/v/release/Kikubay/AnimeLens?label=Version&color=blue">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens/actions/">
    <img alt="Statut CI" src="https://github.com/Kikubay/AnimeLens/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file">
    <img alt="Licence" src="https://img.shields.io/badge/Licence-Copyleft%20Non%20Commercial-blue">
  </a>
</p>

<p align="center">
  Langue: <a href="https://github.com/Kikubay/AnimeLens/blob/main/README.md">English</a> - <a href="https://github.com/Kikubay/AnimeLens/blob/main/README_fr.md">Français</a>
</p>

<br />

> *Note : Une fois qu'AnimeLens sera lancé sur le Chrome Web Store et addons.mozilla.org, l'installation se fera en un seul clic, et la configuration manuelle d'OAuth sera gérée automatiquement en arrière-plan.*

___

## 📑 Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Aperçu](#aperçu)
- [Installation](#installation)
- [Configuration](#configuration)
- [Changer de compte](#changer-de-compte)
- [Mise à jour](#mise-à-jour)
- [Dépannage](#dépannage)
- [Problèmes et suggestions](#problèmes-et-suggestions)
- [Confidentialité et sécurité](#confidentialité-et-sécurité)
- [Licence](#licence)
- [Soutenir le projet](#soutenir-le-projet)

___

## Fonctionnalités

- 🎯 **Recommandations personnalisées** : Obtenez des suggestions d'animés adaptées à votre historique de visionnage, accompagnées d'explications claires sur les raisons de ces recommandations.
- 🔄 **Support de deux fournisseurs** : Connectez simultanément vos comptes **MyAnimeList** et **AniList**.
- ⚡ **Changement de compte instantané** : Basculez facilement entre vos fournisseurs actifs en quelques secondes. Votre liste mise en cache reste disponible hors ligne pendant qu'une nouvelle synchronisation s'exécute discrètement en arrière-plan.
- 📊 **Analyse de profil et Cartes de goût** : Visualisez votre parcours d'animé ! Générez de magnifiques « Cartes de goût » (Taste Cards) partageables, mettant en valeur vos genres préférés, vos statistiques d'achèvement et vos animés les mieux notés (avec une gestion intelligente des ex æquo pour vos favoris absolus).
- 📺 **« Où regarder »** : Ouvrez n'importe quelle recommandation pour voir sur quelles plateformes elle est diffusée, avec un lien direct vers chacune d'elles.
- 🎬 **« Ajouter à la liste » unifié** : Que vous parcouriez les recommandations ou que vous utilisiez les fonctionnalités d'ajout rapide, toutes les actions ciblent automatiquement votre fournisseur actif.
- 🔒 **Architecture respectueuse de la vie privée** : AnimeLens ne demande jamais vos mots de passe ni vos secrets client (Client Secrets). Toutes les sessions OAuth, préférences et données synchronisées sont stockées de manière sécurisée et locale dans le stockage de l'extension de votre navigateur.

___

## Aperçu

> **Essayez-le sans rien installer :** [kikubay.github.io/AnimeLens](https://kikubay.github.io/AnimeLens/)
> - Cette version utilise la véritable interface avec une bibliothèque d'exemple générée directement dans votre navigateur.
> - Aucun compte n'est connecté et aucune donnée n'est enregistrée.

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Discover_GIF.gif?raw=true" width="425" alt="Recommandations AnimeLens">
      <br>
      <sub><b>Recommandations personnalisées</b></sub>
    </td>
    <td align="center">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Profile_GIF.gif?raw=true" width="425" alt="Interface AnimeLens">
      <br>
      <sub><b>Analyse de profil</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/Kikubay/AnimeLens/blob/main/.github/img/Settings_GIF.gif?raw=true" width="450" alt="Paramètres AnimeLens">
      <br>
      <sub><b>Configuration et Paramètres</b></sub>
    </td>
  </tr>
</table>

___

## Installation

<details>
<summary>Option 1a : Chromium (Chrome, Brave, Edge, Opera)</summary>

1. Téléchargez le dernier fichier `Animelens-<version>-chromium.zip` depuis la [page des versions GitHub](https://github.com/Kikubay/AnimeLens/releases).
2. Extrayez le fichier ZIP dans un dossier sur votre ordinateur.
3. Ouvrez Google Chrome, Edge, Brave ou Opera.
4. Accédez à la page des extensions de votre navigateur :
   - **Chrome / Brave** : `chrome://extensions`
   - **Edge** : `edge://extensions`
   - **Opera** : `opera://extensions`
5. Activez le **Mode développeur**.
6. Cliquez sur **Charger l'extension non empaquetée**.
7. Sélectionnez le dossier de l'extension extraite contenant `manifest.json`.

*Ne sélectionnez pas le fichier `ZIP` lui-même. Sélectionnez le dossier contenant `manifest.json`.*

Si AnimeLens est déjà installé, remplacez les anciens fichiers de l'extension par les nouveaux fichiers de la version et cliquez sur **Recharger** sur la carte AnimeLens dans la page des extensions de votre navigateur.
</details>

<details>
<summary>Option 1b : Firefox (Version standard - Temporaire)</summary>

> Firefox standard applique une signature stricte des extensions. Les versions locales ne peuvent être chargées que temporairement et **seront supprimées à la fermeture du navigateur**.

1. Téléchargez le dernier `AnimeLens-<version>-gecko.zip` depuis la [page des versions GitHub](https://github.com/Kikubay/AnimeLens/releases).
2. Extrayez le fichier ZIP dans un dossier sur votre ordinateur.
3. Ouvrez Firefox et allez sur :
   ```text
   about:debugging#/runtime/this-firefox
   ```
4. Cliquez sur **Charger un module complémentaire temporaire…**.
5. Naviguez jusqu'au dossier extrait et sélectionnez le fichier `manifest.json`.

> **Note :** Vous devrez répéter ces étapes à chaque redémarrage de Firefox. Pour une installation permanente sur Firefox standard, attendez que la version signée officielle soit publiée sur [addons.mozilla.org](https://addons.mozilla.org/).
</details>

<details>
<summary>Option 1c : Firefox Developer Edition (Installation permanente)</summary>

> Si vous souhaitez conserver l'extension de manière permanente sans attendre la sortie sur le magasin de Mozilla, **Firefox Developer Edition** est la méthode la plus fiable et recommandée. Elle permet de désactiver les vérifications de signature et d'installer des versions locales de façon permanente.

1. Téléchargez et installez [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) (il fonctionne indépendamment de votre Firefox standard).
2. Ouvrez un nouvel onglet, allez sur `about:config`, et cliquez sur **Accepter le risque et poursuivre**.
3. Recherchez `xpinstall.signatures.required` et double-cliquez dessus pour changer la valeur à **`false`**.
4. Téléchargez le dernier `AnimeLens-<version>-gecko.zip` depuis la [page des versions GitHub](https://github.com/Kikubay/AnimeLens/releases).
5. **Renommez** le fichier `.zip` téléchargé exactement en :  
   `animelens@kikubay.github.io.xpi`  
   *(Cela correspond à l'ID de l'extension épinglé dans la version d'AnimeLens).*
6. Dans Firefox Developer Edition, allez sur `about:support` et cliquez sur le bouton **Ouvrir le dossier** à côté de « Dossier de profil ».
7. Dans ce dossier de profil, créez un nouveau dossier nommé `extensions` (s'il n'existe pas déjà).
8. Déplacez le fichier renommé `animelens@kikubay.github.io.xpi` dans ce dossier `extensions`.
9. **Redémarrez Firefox Developer Edition.**

L'extension sera désormais installée de façon permanente, entièrement fonctionnelle, et survivra à tous les futurs redémarrages de l'ordinateur et du navigateur.
</details>

<details>
<summary>Option 1d : Application de bureau</summary>

Le même tableau de bord est également disponible sous forme d'application de bureau pour Windows, macOS et Linux. Téléchargez l'installateur pour votre plateforme depuis la [page des versions GitHub](https://github.com/Kikubay/AnimeLens/releases) et exécutez-le.

L'application de bureau communique directement avec MyAnimeList et AniList et conserve vos données dans un fichier local. Elle n'est **pas** signée numériquement, attendez-vous donc à un avertissement Windows SmartScreen au premier lancement.

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour savoir comment l'application de bureau et les deux versions de l'extension partagent une base de code unique.
</details>

#### Option 2 : Compiler depuis le code source
1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/Kikubay/AnimeLens.git
   cd AnimeLens
   ```
2. Installez les dépendances (avec votre gestionnaire de paquets préféré) :
   ```bash
   npm install
   ```
3. Compilez l'extension et l'application de bureau :
   ```bash
   npm run build
   ```
4. Chargez le dossier de sortie de l'extension généré (`dist/chromium`) dans Chrome en suivant les étapes de l'**Option 1**.

> `npm run build` produit les trois cibles. La sortie de l'extension est nommée pour le moteur plutôt que pour le navigateur, car une seule compilation sert toute une famille : `dist/chromium` couvre Chrome, Edge, Brave et Opera (chargeable en non empaqueté dans n'importe lequel d'entre eux), et `dist/gecko` est pour Firefox. L'application de bureau se trouve dans `dist/electron`, où `release/` contient l'installateur pour votre plateforme. Compilez chacune sur son propre système d'exploitation — `npm run build:extension` et `npm run build:electron` respectivement.
>
> Les deux versions de l'extension diffèrent à deux endroits : `manifest.json`, car Firefox n'a pas de service worker d'arrière-plan et exécute donc le même bundle en tant que page d'événement avec un ID d'extension Gecko épinglé ; et une surcharge CSS, car la barre de défilement de Firefox prend de la largeur au contenu au lieu de le chevaucher. Exécutez `npm run build:extension:package` pour produire un `.zip` prêt pour le magasin pour chaque cible.
</details>

___

## Configuration

<details>
<summary>MyAnimeList</summary>

- Chaque ordinateur reçoit son propre ID d'extension lorsque l'extension est chargée en mode non empaqueté. Par conséquent, chaque installation doit utiliser une application OAuth MAL configurée pour cette installation.

  1. Ouvrez le popup AnimeLens.
  2. Ouvrez les **Paramètres**.
  3. Ouvrez le panneau de **configuration MAL** (section OAuth).
  4. Copiez l'**URI de redirection** affichée.
  5. Ouvrez la [page des applications API MyAnimeList](https://myanimelist.net/apiconfig).
  6. Créez une nouvelle application OAuth, ou ouvrez-en une existante.
  7. Enregistrez l'URI de redirection copiée depuis AnimeLens exactement comme elle est affichée.
  8. Copiez l'**ID client MAL**.
  9. Collez l'ID client dans AnimeLens sous **ID client MAL**.
  10. Cliquez sur **Enregistrer l'ID client**.
  11. Cliquez sur **Connecter** à côté de MyAnimeList dans la section **Fournisseurs** (ou **Connecter MAL** depuis le tableau de bord).

- L'URI de redirection est générée par le navigateur et diffère selon le magasin. Copiez ce que le panneau de **configuration MAL** vous montre ; les formes sont :

```text
Chromium (Chrome, Edge, Brave, Opera) :  https://<extension-id>.chromiumapp.org/
Firefox :                                 https://<hash>.extensions.allizom.org/
```

  Sur Firefox, le hash est dérivé de l'ID de l'extension, que cette version épingle à `animelens@kikubay.github.io`, la valeur reste donc identique lors des réinstallations et mises à jour.

- L'URI de redirection doit correspondre exactement, y compris la barre oblique finale. N'ajoutez pas de chemin, de chaîne de requête ou d'espaces supplémentaires.
- Un secret client MAL n'est pas requis par AnimeLens. N'entrez jamais votre mot de passe MAL ou votre secret client dans l'extension.
</details>

<details>
<summary>AniList</summary>

- AniList utilise un flux d'autorisation par copier/coller (Auth Pin). Une extension de navigateur ne peut pas terminer la redirection de token d'AniList dans sa propre fenêtre d'authentification, donc AniList affiche le token d'accès sur son propre site et AnimeLens le récupère depuis l'onglet ouvert — aucune copie manuelle n'est nécessaire.

  1. Ouvrez le popup AnimeLens.
  2. Ouvrez les **Paramètres**.
  3. Ouvrez le panneau **ID client AniList** (section OAuth).
  4. Notez l'URL de redirection qui y est indiquée :
     ```text
     https://anilist.co/api/v2/oauth/pin
     ```
  5. Ouvrez les [paramètres développeur d'AniList](https://anilist.co/settings/developer).
  6. Cliquez sur **Créer une nouvelle application** (ou modifiez-en une existante).
  7. Définissez l'**URL de redirection** sur l'URL pin ci-dessus, exactement.
  8. Copiez l'**ID client AniList**.
  9. Collez l'ID client dans AnimeLens sous **ID client AniList**.
  10. Cliquez sur **Enregistrer l'ID client**.
  11. Cliquez sur **Connecter** à côté de AniList dans la section **Fournisseurs**.
  12. AniList s'ouvre dans un nouvel onglet — connectez-vous et cliquez sur **Autoriser**.
  13. Retournez dans le popup AnimeLens : un panneau apparaît sous AniList indiquant que l'autorisation a été détectée. Cliquez sur **Terminer la connexion**.

> Un secret client AniList n'est jamais requis. Si AniList vous affiche une page « Copiez et collez le texte suivant », c'est normal — laissez l'onglet ouvert et cliquez sur **Terminer la connexion** dans AnimeLens ; le token est lu automatiquement. Vous pouvez fermer le popup pendant que vous autorisez : AnimeLens se souvient du token, il sera donc toujours là à votre retour.

- Les tokens d'accès AniList sont de longue durée (environ un an). Lorsqu'il expire, AniList s'affiche comme déconnecté et vous n'avez qu'à autoriser à nouveau.
</details>

___

## Changer de compte

MyAnimeList et AniList peuvent rester connectés en même temps. Dans **Paramètres → Fournisseurs** :

- Chaque carte de fournisseur affiche son statut (**Actif** ou **Connecter** / **Rendre actif** / **Déconnecter**).
- Le fournisseur **actif** reçoit la synchronisation, les recommandations et les actions d'ajout à la liste.
- Le changement est instantané : chaque fournisseur conserve sa propre liste mise en cache, donc revenir en arrière fonctionne même hors ligne, puis une nouvelle synchronisation s'exécute en arrière-plan.

___

## Mise à jour

Lorsqu'une version plus récente est disponible :

1. Cliquez sur **Mettre à jour** dans la bannière de mise à jour d'AnimeLens.
2. Téléchargez le dernier ZIP de la version pour votre navigateur.
3. Remplacez les fichiers existants de l'extension.
4. Rechargez l'extension :
   - **Navigateurs Chromium** : ouvrez `chrome://extensions` (`edge://extensions` sur Edge) et cliquez sur **Recharger** sur AnimeLens.
   - **Firefox** : ouvrez `about:debugging#/runtime/this-firefox`, sélectionnez AnimeLens et cliquez sur **Recharger**.
   - **Application de bureau** : téléchargez et exécutez le nouvel installateur par-dessus l'ancien.

Les navigateurs ne mettent pas à jour automatiquement les extensions installées depuis un dossier non empaqueté, il s'agit donc d'une étape manuelle. Une version signée installée depuis le Chrome Web Store ou addons.mozilla.org se met à jour elle-même.

___

## Dépannage

<details>
<summary>L'extension ne se charge pas</summary>

  - Confirmez que vous avez sélectionné le dossier extrait, et non le fichier ZIP.
  - Confirmez que le dossier sélectionné contient `manifest.json`.
  - Sur Firefox, confirmez que vous avez chargé `manifest.json` depuis **about:debugging**, et que vous avez téléchargé le package Firefox plutôt que celui pour Chromium.
  - Téléchargez à nouveau la dernière version si des fichiers sont manquants.
  - Ouvrez `chrome://extensions` (ou `about:debugging`) et vérifiez les détails des erreurs sur la carte AnimeLens.

</details>

<details>
<summary>Les paramètres affichent une erreur</summary>

  - Assurez-vous d'utiliser la dernière version.
  - Remplacez l'ancien dossier de l'extension par les nouveaux fichiers de la version.
  - Cliquez sur **Recharger** dans `chrome://extensions`.
  - Fermez et rouvrez le popup.

</details>

<details>
<summary>MAL rejette l'URI de redirection</summary>

  - Copiez l'URI de redirection directement depuis les paramètres d'AnimeLens.
  - Enregistrez-la dans l'application MAL appartenant à l'ID client saisi.
  - Vérifiez que l'ID de l'extension est correct.
  - Vérifiez la barre oblique finale.
  - N'ajoutez pas de chemin, de chaîne de requête, d'espace ou de barre oblique supplémentaire.
  - Rechargez l'extension après avoir modifié ses fichiers.

</details>

<details>
<summary>L'authentification ne se termine pas</summary>

  - Confirmez que l'ID client a été enregistré.
  - Confirmez que l'ID client appartient à l'application du fournisseur contenant l'URL de redirection enregistrée.
  - Confirmez que Chrome est connecté à Internet.
  - Vérifiez les erreurs du service worker d'AnimeLens dans `chrome://extensions`.
  - Si le stockage de l'extension Chrome a été effacé, configurez l'ID client et connectez-vous à nouveau.

</details>

<details>
<summary>AniList affiche une page d'erreur après l'autorisation</summary>

  - <code>unsupported_grant_type</code> : Mettez à jour AnimeLens et rechargez-le.
  - <code>DNS address not found / chromiumapp.org</code> : l'<strong>URL de redirection</strong> de l'application AniList est toujours l'URL de l'extension. Changez-la pour <code>https://anilist.co/api/v2/oauth/pin</code> dans les <a href="https://anilist.co/settings/developer">paramètres développeur d'AniList</a>.
  - Après avoir changé l'URL de redirection, rechargez l'extension et connectez-vous à nouveau.

</details>

<details>
<summary>Le panneau « Terminer la connexion » d'AniList n'apparaît pas</summary>

  - Gardez l'onglet AniList ouvert après l'autorisation — le token est extrait de l'URL de cet onglet.
  - Assurez-vous qu'AniList n'est pas déjà indiqué comme connecté dans la section Fournisseurs.
  - Rechargez l'extension et rouvrez les Paramètres ; le panneau interroge le serveur une fois par seconde pendant que les Paramètres sont ouverts, et le token est mémorisé, donc fermer le popup en cours d'autorisation n'est pas gênant.
  - Si cela échoue toujours, déconnectez AniList, cliquez à nouveau sur Connecter, et autorisez une fois de plus.

</details>

<details>
<summary>AniList s'affiche comme déconnecté</summary>

  - Les tokens d'accès AniList durent environ un an ; après expiration, vous devez autoriser à nouveau (le bouton Connecter réapparaît automatiquement).
  - Si vous avez changé l'ID client AniList dans les Paramètres, la session AniList enregistrée est effacée — connectez-vous à nouveau.

</details>

<details>
<summary>Mon ID client ne fonctionne pas sur un autre ordinateur</summary>

  - C'est normal pour les extensions non empaquetées. L'autre ordinateur peut avoir un ID d'extension différent.
  - Ouvrez les paramètres d'AnimeLens sur cet ordinateur et enregistrez son URI de redirection affichée dans l'application OAuth MAL correspondante.

</details>

___

## Problèmes et suggestions

- 🐛 **Vous avez trouvé un bug ?** [Ouvrez un problème](https://github.com/Kikubay/AnimeLens/issues/new?template=bug_report.md)
- 💡 **Vous avez une idée de fonctionnalité ?** [Ouvrez une demande de fonctionnalité](https://github.com/Kikubay/AnimeLens/issues/new?template=feature_request.md)

___

## Confidentialité et sécurité

- AnimeLens ne demande ni ne stocke votre mot de passe MAL ou AniList.
- AnimeLens ne requiert pas de secret client pour l'un ou l'autre des fournisseurs.
- Les ID clients sont des configurations OAuth publiques.
- L'autorisation AniList est lue depuis l'URL de l'onglet de la page pin et stockée localement ; elle n'est jamais envoyée nulle part sauf à l'API propre d'AniList.
- Les sessions OAuth, les préférences, les données d'animés synchronisées et les retours sur les recommandations sont stockés localement dans le stockage de l'extension de votre navigateur.
- Les requêtes sont faites directement depuis l'extension vers MyAnimeList, AniList et GitHub.

___

## Licence

AnimeLens est sous une licence **copyleft non commerciale** personnalisée, basée sur la philosophie de l'AGPL. Elle est libre et ouverte pour inspection, étude, copie, modification et redistribution à des fins **non commerciales**, avec de fortes obligations de copyleft : les travaux dérivés doivent rester sous la même licence et doivent offrir leur code source complet, y compris sur le réseau.

**L'utilisation commerciale est interdite** sans autorisation écrite explicite du titulaire des droits d'auteur. Une licence commerciale distincte peut être accordée sur demande.

Étant donné que l'utilisation commerciale est restreinte, il s'agit d'une licence à code source disponible (source-available), et non d'une licence « open source » approuvée par l'OSI. Consultez le fichier [LICENSE](https://github.com/Kikubay/AnimeLens?tab=License-1-ov-file) pour les conditions complètes.

© 2026 Kikubay. Tous droits réservés sauf autorisation expresse.

*Note : AnimeLens est un projet indépendant et n'est pas affilié à MyAnimeList ou AniList, ni approuvé par eux.*

___

## Soutenir le projet

Si AnimeLens vous est utile, envisagez de donner une ⭐ au dépôt. Cela aide d'autres développeurs à découvrir le projet.
