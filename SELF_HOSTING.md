# Self-hosting AnimeLens

AnimeLens ships as a browser extension and a desktop app. Neither installs a service, a database
or an agent on your machine. This image is for the case the desktop app does not cover: you want
AnimeLens running on a machine you own — a NAS, a home server, a spare mini PC — and reaching it
from a browser on another one, without installing anything locally.

## What this image is, and what it is not

The container runs the **desktop build** against a virtual screen, streamed to your browser over
noVNC. It is the same program a normal desktop install runs, drawing on a virtual display instead
of a monitor.

It is **not** a backend. AnimeLens has no server, and this image does not add one:

- AnimeLens still calls MyAnimeList and AniList **directly from the container**. There is no proxy
  in the path, so the privacy guarantees in the README are unchanged.
- Your provider tokens live in the container's own volume, not in a service someone else operates.
- There is nothing to migrate, seed or back up besides that one volume.

If you only want the extension, you do not need any of this. Load it unpacked from
`dist/chromium/` and it never contacts anything but the providers.

## Requirements

- Docker with Compose v2, or plain `docker run`.
- A browser with WebSocket support. Every current browser has one.
- About 1 GB of disk for the image, and a 1280x900 virtual screen, which the dashboard is sized for.

`amd64` and `arm64` are both published, so Raspberry Pi 4/5 and Apple Silicon are covered.

## Quick start

```sh
git clone https://github.com/Kikubay/AnimeLens.git
cd AnimeLens
cp docker/.env.example docker/.env   # then set VNC_PASSWORD
docker compose --file docker/docker-compose.yml up --detach
```

Then open **<http://localhost:6080/vnc.html>**, enter the VNC password, and AnimeLens is in front
of you.

The compose file publishes two ports, both bound to `127.0.0.1` on the host on purpose. See
[Signing in](#signing-in) for why the second one exists, and [Security](#security) for what that
binding is protecting.

### Without Compose

```sh
docker build --file docker/Dockerfile --tag animelens:local .

docker run --detach --name animelens \
  --publish 127.0.0.1:6080:6080 \
  --publish 127.0.0.1:8976:8976 \
  --env VNC_PASSWORD=choose-something \
  --env ANIMELENS_AUTH_BIND_HOST=0.0.0.0 \
  --volume animelens-config:/config \
  --restart unless-stopped \
  animelens:local
```

## Signing in

Both providers are configured from inside AnimeLens' own settings panel, and both need a Client ID
registered with the provider. Copy the Client ID from the provider's developer page into
AnimeLens. The redirect URI is the part that differs in a container.

### AniList

AniList uses a **PIN flow**: the site shows a code, you paste it into AnimeLens, and no redirect
is ever followed. It works from a container with no extra setup. Register
`https://anilist.co/api/v2/oauth/pin` as the redirect URL on your AniList developer page.

### MyAnimeList

MAL uses an OAuth code flow with a redirect back to the browser, and MAL will only accept a
**loopback** redirect URI. Two consequences, both of which the compose file already handles:

1. **Register `http://127.0.0.1:8976/`** as the redirect URL on your MAL developer application.
   This is the same URI a local desktop install uses, so an application you already have works
   unchanged.
2. **The callback has to reach the browser, not the container.** MAL sends the browser to
   `127.0.0.1:8976` on whatever machine the browser is on. When the browser is on a different
   machine than the container, forward the port over SSH first:

   ```sh
   ssh -L 8976:127.0.0.1:8976 user@your-server
   ```

   Leave that session open, start sign-in in AnimeLens, and the redirect resolves on its own.

Behind this, `ANIMELENS_AUTH_BIND_HOST` makes the listener bind `0.0.0.0` inside the container
instead of its own loopback. Without it, a published port cannot reach the listener at all. The URI
AnimeLens advertises to MAL stays `127.0.0.1` regardless, because that is the only form MAL
accepts — widening the bind never widens what is registered.

Set `shell.openExternal` aside: the container has no browser to hand the MAL consent page to, so
read the URL AnimeLens shows, open it in your own browser, and finish there. If the consent page
opens nothing, that is why — use the URL shown in the AnimeLens window.

## Configuration

| Variable                     | Default                   | Purpose                                                                                                             |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `VNC_PASSWORD`               | generated once and logged | Password for the noVNC session. Classic VNC auth only carries eight characters, so anything past that is truncated. |
| `ANIMELENS_CONFIG_DIR`       | `/config`                 | Where settings, tokens and library state are stored. Mount this to keep them across upgrades.                       |
| `ANIMELENS_AUTH_BIND_HOST`   | `127.0.0.1`               | Address the MAL callback listener binds. Set to `0.0.0.0` only when port `8976` is published.                       |
| `ANIMELENS_CHROMIUM_SANDBOX` | `false`                   | Set to `true` to keep the Chromium sandbox on. Requires granting `SYS_ADMIN` to the container.                      |
| `SCREEN_SIZE`                | `1280x900x24`             | Virtual screen geometry. The dashboard is laid out for at least `731x716`.                                          |
| `NOVNC_PORT`                 | `6080`                    | Port serving the web client.                                                                                        |
| `VNC_PORT`                   | `5900`                    | Raw VNC port. Bound to the container's loopback; you do not need to publish it.                                     |

## Security

Read this before putting the container on a network you do not fully control.

- **The noVNC session is a plain VNC connection.** The password is eight characters, VNC auth is
  weakly hashed, and the traffic is not encrypted. Anyone who reaches port `6080` can see your
  dashboard and interact with it. The compose file therefore binds it to `127.0.0.1`; put a reverse
  proxy with real authentication and TLS in front of it before changing that.
- **A connected viewer can drive the app**, including clicking through settings and the provider
  sign-in flow. Treat the container as an application with full control over its own session.
- **The Chromium sandbox is off by default.** Containers deny it the privileges it needs. If that
  matters to you, add `cap_add: [SYS_ADMIN]` to the service and set
  `ANIMELENS_CHROMIUM_SANDBOX: 'true'`.
- **The container runs as an unprivileged user** (`animelens`, uid 10001), writes only to
  `/config`, and the compose service drops every Linux capability with `no-new-privileges` set.
- **`ANIMELENS_AUTH_BIND_HOST=0.0.0.0` exposes the OAuth callback listener** on whatever the
  published port maps to. PKCE state checking means a forged callback cannot complete a sign-in,
  but keep it on loopback where you can.

## Updating

```sh
docker compose --file docker/docker-compose.yml pull
docker compose --file docker/docker-compose.yml up --detach
```

State lives in the `animelens-config` volume, so an update replaces the app without touching your
accounts or library.

## Backing up

Everything worth keeping is one file in the volume:

```sh
docker run --rm -v animelens-config:/config -v "$PWD:/backup" debian:bookworm-slim \
  tar czf /backup/animelens-backup.tar.gz -C /config .
```

Treat it as a secret. It contains your MAL and AniList access tokens in plain text, which is the
same posture as a normal desktop install and the reason the extension and the app keep tokens in
local storage instead of a server.

## Troubleshooting

**The page loads but stays black.** The VNC handshake did not complete. Check
`docker compose --file docker/docker-compose.yml logs` for the password that was generated, and
confirm your browser is on the same machine as the published port.

**MAL sign-in opens no window.** Expected: the container has no browser. Read the URL from the
AnimeLens window and open it in your own browser. If the redirect then fails to load, forward
port `8976` over SSH as described above.

**MAL rejects the redirect URI.** It must be exactly `http://127.0.0.1:8976/`, trailing slash
included, with no path or query string.

**Japanese titles render as boxes.** The image ships Noto CJK. If you replaced the base image, add
`fonts-noto-cjk`.

**The container restarts immediately.** The Chromium sandbox is the usual cause. Confirm
`ANIMELENS_CHROMIUM_SANDBOX` is `false`, or grant `SYS_ADMIN` and set it to `true`.

## Building the image yourself

```sh
npm run docker:build
```

The build compiles the desktop app inside the image, so it needs no Node toolchain on the host and
no build output checked out beforehand. The image deliberately contains **no client IDs** — your
`.env.development` and `.env.production` are excluded from the build context — so you register your
own providers from the settings panel rather than inheriting someone else's quota.

## Why there is no self-hosted API server

It is a fair question, and the answer is deliberate. A proxy that sat between the app and the
providers would have to hold your OAuth tokens: the server would see which titles you browsed, and
that account would sit on hardware you now administer and patch. It would also contradict the
claim this project is built on — that AnimeLens talks to MyAnimeList and AniList directly and
nowhere else — and would turn a single-user app into a service with an authentication surface, a
rate-limit story and a patch cadence.

Running the existing desktop app in a container gets you the thing actually being asked for,
without a server behind it. If a future AnimeLens ever needs one, it should be a different product
with a different threat model, not a mode flag on this one.
