# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-bookworm-slim
ARG RUNTIME_IMAGE=debian:bookworm-slim


FROM ${NODE_IMAGE} AS build

WORKDIR /workspace

# Dependencies first so a source-only change reuses the install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json ./
COPY electron ./electron
COPY public ./public
COPY src ./src
COPY vite.electron.node.config.ts vite.electron.renderer.config.ts ./

RUN npm run build:electron:node && npm run build:electron:renderer

# Electron reads the app version from package.json only when it is launched by directory, and only
# from a manifest it finds itself. The container ships one of its own instead of the development
# manifest, which carries dependency trees and scripts the packaged app has no use for.
RUN node -e "\
const fs = require('node:fs'); \
const source = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
const manifest = { name: source.name, version: source.version, type: 'module', main: 'main.mjs' }; \
fs.writeFileSync('dist/electron/app/package.json', JSON.stringify(manifest, null, 2) + '\n'); \
"


FROM ${RUNTIME_IMAGE} AS runtime

ARG NOBODY_UID=10001
ARG NOBODY_GID=10001

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY_NUMBER=99 \
    SCREEN_SIZE=1280x900x24 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    ANIMELENS_CONFIG_DIR=/config \
    ELECTRON_NO_ATTACH_CONSOLE=1 \
    HOME=/tmp

RUN apt-get update \
    && apt-get install --no-install-recommends --yes \
        # The desktop window itself.
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdrm2 \
        libgbm1 \
        libgtk-3-0 \
        libpango-1.0-0 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        libnss3 \
        # Anime titles are Japanese more often than not, so a CJK face is not optional here.
        fonts-liberation \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        # A virtual display, a VNC server, and the web client that carries it over HTTP.
        novnc \
        websockify \
        x11vnc \
        xvfb \
        # PID 1, so signals reach the entrypoint and the display server's children get reaped.
        tini \
        ca-certificates \
        wget \
    && rm -rf /var/lib/apt/lists/*

# The container owns a virtual screen and nothing else, so it needs no capability of its own.
# `nobody` is deliberately not reused here: its uid is already bound on Debian and a second
# entry pointing at it makes ownership ambiguous on the mounted volume.
RUN groupadd --gid "${NOBODY_GID}" animelens \
    && useradd --uid "${NOBODY_UID}" --gid "${NOBODY_GID}" --no-create-home --shell /usr/sbin/nologin animelens \
    && mkdir -p /opt/animelens/app /config \
    && chown -R animelens:animelens /opt/animelens /config

COPY --from=build --chown=animelens:animelens /workspace/dist/electron/app /opt/animelens/app

# The Chromium runtime resolves its pak files, locales and ICU data relative to this binary.
COPY --from=build --chown=animelens:animelens /workspace/node_modules/electron /opt/animelens/electron

COPY --chown=animelens:animelens docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

# The app directory, not the entry script: naming main.mjs directly makes Electron skip the
# manifest and report its own version as the app's, which silently disables the update check.
ENV ELECTRON_BIN=/opt/animelens/electron/dist/electron \
    APP_DIR=/opt/animelens/app \
    NOVNC_ROOT=/usr/share/novnc

USER animelens
WORKDIR /opt/animelens
VOLUME ["/config"]
EXPOSE 6080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${NOVNC_PORT}/vnc.html" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]