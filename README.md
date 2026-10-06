# create-erxes-plugin

Scaffold a standalone erxes plugin repository: an API that registers itself
with the erxes gateway and a React Module Federation remote that core-ui loads.

## Install

The CLI ships as a standalone binary — no Node.js is needed to run it (the
generated plugin itself still needs Node.js/pnpm for development).

macOS / Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.ps1 | iex
```

Pin a release or choose the install directory:

```sh
curl -fsSL https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.sh | sh -s -- --version 0.2.0 --dir ~/bin
```

`--version`/`CREATE_ERXES_PLUGIN_VERSION` and `--dir`/`CREATE_ERXES_PLUGIN_INSTALL_DIR`
are equivalent. The installer picks `/usr/local/bin` when writable, otherwise
`~/.local/bin`; on Windows it uses `%LOCALAPPDATA%\Programs\create-erxes-plugin`
and adds it to the user PATH. Release assets are
`create-erxes-plugin-<os>-<arch>.tar.gz` (`-musl` suffixed for Alpine and
friends) and `create-erxes-plugin-windows-x64.zip`, verified against the
release's `SHA256SUMS`. `create-erxes-plugin --version` prints the version.

Or via a package manager (requires Node.js ≥ 22.12):

```sh
npm create @erxes/plugin@latest inventory
# or
pnpm create @erxes/plugin inventory
yarn create @erxes/plugin inventory
bun create @erxes/plugin inventory
npx @erxes/create-plugin inventory
```

The npm package is [`@erxes/create-plugin`](https://www.npmjs.com/package/@erxes/create-plugin);
the command it installs is `create-erxes-plugin`.

The CLI asks for anything not passed as a flag:

| Flag                       | Default                         |
| -------------------------- | ------------------------------- |
| `[directory]`              | plugin name                     |
| `-n, --name <name>`        | directory name                  |
| `-t, --title <title>`      | name in Title Case              |
| `-d, --description <text>` | `<title> plugin for erxes`      |
| `-b, --backend <backend>`  | `platform` (erxes-api-shared `startPlugin`, Node.js) or a standalone framework: `express`, `fastify`, `hono`, `elysia` (Bun only), `nestjs`; asked interactively |
| `--pm <npm\|pnpm\|yarn\|bun>` | the package manager running the CLI |
| `--api-port <port>`        | `3399`                          |
| `--ui-port <port>`         | `3099`                          |
| `--no-install`, `--no-git` | install and `git init` run      |
| `-y, --yes`                | accept defaults                 |

Plugin names are lowercase words separated by single dashes
(`inventory`, `erxes-agent-v2`).

## What it generates

```
erxes.json        plugin identity and ports, read by api/ and ui/
api/              platform stack: erxes-api-shared startPlugin + tenant Mongoose models (Node.js)
                  standalone stacks: Express, Fastify, Hono or Elysia (Bun) subgraph APIs,
                  or NestJS code-first federation (Node.js)
ui/               React 18 Rspack Module Federation remote, prefixed Tailwind CSS —
                  overview/settings pages plus a notification inbox widget
Dockerfile        API-only image for the chosen package manager
README.md, AGENTS.md, docs/erxes-integration.md
```

The generated plugin registers with erxes exactly like erxes-api-shared
`joinErxesGateway` — from `api/src/gateway.ts` for `express`, via `startPlugin`
for `platform` — and follows the core-ui remote contract. See
`templates/base/docs/erxes-integration.md`.

erxes's shared libraries come from npm: the UI depends on `@erxes/ui` and
`@erxes/ui-modules`, the platform API on `@erxes/api-shared`, each installed
under the name erxes code imports (`erxes-ui`, `ui-modules`,
`erxes-api-shared`). Any of the four package managers can install them.

## Layout

```
src/cli.ts        prompts (@clack/prompts) and flags (commander)
src/scaffold.ts   copies template layers and fills tokens (__name__, __Pascal__, …)
src/generated.ts  files that depend on options: erxes.json, package.json, Dockerfile
src/stacks.ts     backends, frontends, package managers
templates/base    root files
templates/api/shared   framework-neutral API files (config, gateway registration)
templates/api/<backend>
templates/ui/react
scripts/embed-templates.ts   embeds templates/ into src/templates.generated.ts
scripts/compile.ts           bun --compile per-target binaries into dist/bin/
install.sh / install.ps1     standalone-binary installers
```

Dotfiles are stored as `_gitignore`, `_dockerignore`, `_env.example` because
npm drops them from published packages.

### Adding a backend

1. Add `templates/api/<backend>/` with `package.json`, `tsconfig.json` and
   `src/` that serve `GET /health` and `/graphql`. A stack lists its layers in
   `templates` (`src/stacks.ts`) and they are copied in order into `api/`;
   `api/standalone` already provides `gateway.ts` (the local `joinErxesGateway`
   mirror) and the header-agnostic `context.ts`, and `api/standalone-schema`
   the prefixed status subgraph.
2. Register it in `BACKENDS` with its `integration`, label/hint, `templates`
   layers, and scripts + dev dependencies per runtime (`node`, `bun`).

## Develop

```sh
pnpm install
pnpm dev my-plugin --pm pnpm      # run the CLI from source
pnpm test                         # scaffolds every package manager into a temp dir
pnpm check && pnpm lint
pnpm build                        # dist/ for publishing
pnpm compile darwin-arm64         # standalone binary in dist/bin/<target>/
```

### Releasing

Push a `vX.Y.Z` tag: `.github/workflows/release.yml` compiles every target,
packs `dist/release/` archives plus `SHA256SUMS`, and publishes a GitHub
release. A `workflow_dispatch` run exercises the same pipeline without
publishing.
