# __title__

__description__

An erxes plugin that lives outside the erxes monorepo and joins an erxes stack
without erxes source changes.

| Part   | Path         | Stack                                                    | Dev port    |
| ------ | ------------ | -------------------------------------------------------- | ----------- |
| API    | `api`        | __runtime__, __backendHint__                             | __apiPort__ |
| UI     | `ui`         | React 18 Module Federation remote (Rspack), Tailwind CSS | __uiPort__  |
| Shared | `erxes.json` | Plugin identity and ports read by both parts             |             |

The UI consumes the monorepo's `erxes-ui`/`ui-modules` design system as a git
dependency on `erxes/erxes@__erxesRef__` (see
[docs/erxes-integration.md](docs/erxes-integration.md#shared-libraries)). The
host supplies them at runtime via Module Federation singletons — they are
installed only so TypeScript and Rspack can resolve the imports.

## Develop

```sh
__pm__ install
cp .env.example .env
__pmRun__ dev:api   # registers with the erxes gateway through Redis
__pmRun__ dev:ui    # serves http://localhost:__uiPort__/remoteEntry.js
```

In the erxes checkout `.env`, add the plugin and restart the gateway and
core-api so they pick it up:

```sh
ENABLED_PLUGINS=...,__name__
```

Then open `http://localhost:3001/__name__`. Requests reach the API through the
gateway (`/graphql`), which forwards the signed-in user and tenant. To call the
API directly:

```sh
curl localhost:__apiPort__/graphql -H 'content-type: application/json' \
  -d '{"query":"query __camel__Status { __camel__Status { plugin subdomain userEmail } }"}'
```

## Scripts

| Script              | What it does                   |
| ------------------- | ------------------------------ |
| `__pmRun__ dev:api` | API in watch mode              |
| `__pmRun__ dev:ui`  | UI remote dev server           |
| `__pmRun__ build`   | Production build of every part |
| `__pmRun__ check`   | Type-check every part          |
| `__pmRun__ lint`    | oxlint                         |
| `__pmRun__ fmt`     | oxfmt                          |

## Deploy

- **API**: `docker build --build-arg UI_ENTRY_URL=<remoteEntry.js URL> -t <image> .`
  The image serves the API on port 80 and registers itself on start
  (`plugin-__name__-api:80` unless `LOAD_BALANCER_ADDRESS` is set).
- **UI**: upload `ui/dist` to a static host or CDN. Upload hashed assets
  first and `remoteEntry.js` last with `Cache-Control: no-store`. Without
  `UI_ENTRY_URL`, erxes loads `https://plugins.erxes.io/<release>/__name___ui/remoteEntry.js`.

See [docs/erxes-integration.md](docs/erxes-integration.md) for how the plugin
plugs into erxes and [AGENTS.md](AGENTS.md) for the rules to keep it working.
