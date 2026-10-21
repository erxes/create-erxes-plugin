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
Printed next steps target a POSIX shell on macOS/Linux and PowerShell on Windows;
the directory command quotes the target path literally for that shell.

## What it generates

```
erxes.json        plugin identity and ports, read by api/ and ui/
api/              platform stack: erxes-api-shared startPlugin + tenant Mongoose models (Node.js)
                  standalone stacks: Express, Fastify, Hono or Elysia (Bun) subgraph APIs,
                  or NestJS code-first federation (Node.js)
ui/               React 18 Rspack Module Federation remote, prefixed Tailwind CSS —
                  overview and plugin-owned nested settings with AppLayout
                  GraphQL types generated from the printed API schema (graphql-codegen)
Dockerfile        API-only image for the chosen package manager
README.md, AGENTS.md, docs/erxes-integration.md
```

The generated plugin registers with erxes exactly like erxes-api-shared
`joinErxesGateway` — from `api/src/gateway.ts` for every standalone framework,
via `startPlugin` for `platform` — and follows the core-ui remote contract. See
`templates/base/docs/erxes-integration.md`.

erxes's shared libraries come from npm: the UI depends on `@erxes/ui` and
`@erxes/ui-modules`, the platform API on `@erxes/api-shared`, each installed
under the name erxes code imports (`erxes-ui`, `ui-modules`,
`erxes-api-shared`). Any of the four package managers can install them.
The platform stack requires Yarn 4+ (CI uses 4.18.1): published
`@erxes/api-shared` rejects Yarn Classic through its package-manager engine
field. Use Corepack to activate Yarn 4 or select pnpm; do not disable engine
or peer checks.
The tested host baseline is **erxes 3.3.2**. Generated projects pin
the compatible **3.3.4 shared-library cohort**: `@erxes/ui`,
`@erxes/ui-modules`, and `@erxes/api-shared`, all pinned exactly. No registry `latest` lookup or floating erxes range
is used when generating a project. React and ReactDOM 18.3.1 constraints are
included automatically for transitive peers; no manual overrides are needed.
Validate the package cohort against the host when upgrading; runtime host-only
singletons do not provide version isolation.
Platform projects also constrain the tested telemetry cohort: Sentry Node
10.76.2, OpenTelemetry API 1.9.1, instrumentation 0.220.0 and trace SDK 2.12.0.
The unconstrained graph selects API 1.10, outside the SDK's `<1.10` peer range.
Root npm/pnpm overrides or Yarn resolutions preserve compatible real packages;
peer checks remain enabled. Update these constraints together only after fresh
strict pnpm, npm and Yarn 4 platform install/codegen/check/lint/build checks.

The baseline exposes are `./config` (named `CONFIG`) and `./<ui.name>` (page
component). Settings live at `/<ui.path>/settings`, not `/settings/<plugin>`.
The public plugin name (including dashes) is shared by `ui.name`, CONFIG,
page exposes and API permissions. Only the federation container is normalized:
`inventory-tools` exposes `./inventory-tools` in `inventory_tools_ui`, with the
renderable `InventoryTools` export. Dashed names require the platform fixes
that preserve discovery remote keys separately and resolve dashed page exports;
this generator does not patch erxes. Use a single-word name on older hosts. Generated APIs must remain behind a trusted gateway:
forwarded `user`/tenant headers are assertions, not independent authentication.

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
The npm package includes only the compiled Node CLI modules in `dist/*.js`.
Standalone executables and release archives in `dist/bin` and `dist/release`
belong to the separate GitHub release workflow and are excluded from npm packs.

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
pnpm test:e2e                     # packed CLI: external install/codegen/check/lint/build
E2E_CASE=platform-pnpm pnpm test:e2e # one matrix case
pnpm compile darwin-arm64         # standalone binary in dist/bin/<target>/
```

### Releasing

CI and release both require `.github/workflows/deliverables.yml`: all six
backends plus npm/yarn coverage on the platform stack, each with a React
production remote. The test installs the npm-packed CLI outside the checkout,
checks installed peers, runs codegen/check/lint/build, and checks emitted
federation exposes and the absence of bundled host-singleton fallbacks.
Platform cases also execute generated authorization/pagination regressions
without starting databases. This is not a full live erxes deployment test.

Merging to `main` publishes `@erxes/create-plugin` from CI. Bump
`package.json` in that pull request. If that exact version is already on
npm, the workflow leaves it there. No local `npm publish` and no one-time
password are required.

Push a `vX.Y.Z` tag when you also want the standalone binary GitHub release.
`.github/workflows/release.yml` compiles every target, packs `dist/release/`
archives plus `SHA256SUMS`, and publishes that GitHub release. A
`workflow_dispatch` run exercises the same pipeline without publishing.
