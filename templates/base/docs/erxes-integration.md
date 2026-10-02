# How __name__ plugs into erxes

erxes discovers this plugin at runtime. Nothing in the erxes repository
references it except the `ENABLED_PLUGINS` entry.

## Names

All of these come from `erxes.json`. They must stay consistent.

| Name           | Value                      | Used by                                                        |
| -------------- | -------------------------- | -------------------------------------------------------------- |
| `name`         | `__name__`                 | Redis keys, `ENABLED_PLUGINS`, CDN folder, docker host         |
| `ui.name`      | `__id__`                   | `CONFIG.name`, page expose `./__id__`, permission checks       |
| `ui.remote`    | `__remote__`               | Module Federation container (core-api derives it from `name`)  |
| `ui.path`      | `__name__`                 | Route `/__name__/*` in core-ui                                 |
| GraphQL prefix | `__camel__` / `__Pascal__` | Operation, field and type names (unique across the supergraph) |

## API registration

On start, `api/src/gateway.ts` writes what erxes-api-shared `joinErxesGateway`
writes:

- `erxesservice:config:__name__`: `{ dbConnectionString, hasSubscriptions, meta, releaseVersion, uiEntry }`.
  `uiEntry` is `UI_ENTRY_URL`; `releaseVersion` is `RELEASE_VERSION` when it
  starts with `3.`, otherwise `latest`.
- `erxes-service-__name__`: the address the gateway proxies to.
  `LOAD_BALANCER_ADDRESS`, else `http://localhost:<port>` in development and
  `http://plugin-__name__-api:<port>` otherwise.
- In production only: the `gateway:update-apollo-router:pending` lock (30 s)
  and a BullMQ job `service-discovery-updated` on queue
  `gateway-update-apollo-router`. Without it a production gateway never
  recomposes the supergraph.

The gateway only composes plugins listed in its `ENABLED_PLUGINS`.

## Requests

The gateway forwards every request with:

- `user`: base64 JSON of the signed-in user (`_id`, `email`, …), absent for
  anonymous requests.
- `hostname` (or `nginx-hostname` behind nginx): the erxes host. Its first
  label is the tenant `subdomain`.

`api/src/context.ts` turns both into the GraphQL context. A malformed `user`
header is treated as anonymous.

The API serves `GET /health` and a federated subgraph at `/graphql`
(Federation v2). Every type and operation carries the plugin prefix because
all plugins share one supergraph.

## UI loading

1. core-api `GET /get-frontend-plugins` returns `{ name: "__remote__", entry }`
   for each enabled plugin. `entry` is the registered `uiEntry`, or
   `https://plugins.erxes.io/<releaseVersion>/__name___ui/remoteEntry.js`.
2. core-ui loads `__remote__/config` and reads the exported `CONFIG`.
3. core-ui routes `/<CONFIG.path>/*` to `__remote__/<CONFIG.name>` and renders
   its default export or the export named in PascalCase (`__Pascal__`).
4. `react`, `react-dom`, `react-router` and `@apollo/client` are the host's
   singletons, so the page runs inside core-ui's router and ApolloProvider
   with the user's auth cookie. The remote never bundles them.

core-ui in development also registers remotes it gets from
`/get-frontend-plugins`, so `pnpm dev:ui` in erxes plus `__pmRun__ dev:ui` here
is enough.

## Styling

core-ui ships Tailwind preflight and unprefixed utilities for its own code.
This remote compiles its own utilities with the `__twPrefix__:` prefix
(`ui/src/styles.css`), mapped to the host's design tokens (`--background`,
`--muted-foreground`, …). The prefix keeps the plugin's CSS from overriding
the host or other plugins.

## Permissions

core-ui guards the route with `hasPluginPermission(CONFIG.name)`, which only
restricts plugins that core-api lists in `pluginsWithPermissions`, i.e. plugins
whose registered `meta.permissions` declares modules or default groups. That
list holds the plugin `name` (`__name__`) while the guard checks `CONFIG.name`
(`__id__`); for a dashed name they differ and the route guard never blocks.
Enforce access in the API resolvers, never only in the UI.
