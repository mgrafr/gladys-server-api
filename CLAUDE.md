# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** (manifest `type: "provider"`): a
Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template.

It drives one sub-container, `server-api`
([mgrafr/server-api](https://github.com/mgrafr/server-api), image
`mgrafr/server-api:v4`): a Fastify server whose `GET /backup` runs `save.sh`
and answers the `datas.tar.gz` archive.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: registerHandlers, then connect()
src/app.js                        every handler (actions, scene action, widget, lifecycle)
src/serverApi.js                  server-api driver: container files, /backup, state in /data
src/widgets.js                    content of the last_backup widget
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/save.sh                       backup script written into the sub-container volume
gladys-assistant-integration.json manifest: config_schema, actions, containers, widgets...
docs/en.md, docs/fr.md            user documentation, re-hosted by Gladys (mandatory)
test/                             node --test, against the SDK's fake Gladys (integration-sdk/testing)
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **Keys are forever**: manifest `config_schema`, `actions`, `scene_actions`,
  widget and container names. Users store them in scenes and dashboards.
- **The container rootfs is read-only.** Write only under `/data`. The
  sub-container volume `/opt/server-api` is `/data/containers/server-api/opt/server-api`
  on this side.
- **The sandbox cannot mount host paths**: the sub-container never sees the
  real `/var/lib/gladysassistant`. Do not pretend otherwise in texts; the
  `server_url` setting is the way to a real backup.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree. The `server-api` image is
  third-party for the release script: its tag is changed by hand.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md`. Never write a version heading.
- **Manifest.** Texts are multi-language objects `{ "en": ..., "fr": ... }`.
  The catalog `description` holds 10 to 100 characters per language.
  `test/manifest.test.js` ties the manifest to the code: change both sides
  together.
- **User-facing text** is bilingual (English and French), docs kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (`fetch` is injected).
