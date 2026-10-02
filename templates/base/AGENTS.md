# __name__

__description__

An erxes plugin outside the erxes monorepo: `api/` (__runtime__, Express 5,
Apollo federated subgraph) and `ui/` (React 18 Module Federation remote).
`erxes.json` is the single source of the plugin's identity and ports.

## Commands

- `__pm__ install`
- `__pmRun__ dev:api` / `__pmRun__ dev:ui`
- `__pmRun__ check`, `__pmRun__ lint`, `__pmRun__ build`, `__pmRun__ fmt`
- `docker build --build-arg UI_ENTRY_URL=<remoteEntry.js URL> -t <image> .`

Run `check`, `lint` and `build` before calling a change done.

## Naming invariants

See `docs/erxes-integration.md`. In short:

- `erxes.json` `name` (`__name__`) drives Redis keys, `ENABLED_PLUGINS`, the
  docker host `plugin-__name__-api` and the CDN folder `__name___ui`.
- `ui.name` (`__id__`) is `CONFIG.name` and the page expose `./__id__`;
  `ui.remote` (`__remote__`) is what core-api derives from `name`.
- Change names only in `erxes.json`, and only all together.

## Contracts

- `api/src/gateway.ts` mirrors erxes-api-shared `joinErxesGateway`: same Redis
  keys, same config JSON shape, and in production the router-update lock plus
  the BullMQ `gateway-update-apollo-router` job. Do not drop the job.
- `api/src/context.ts` is the only place that reads gateway headers (`user`,
  `hostname`/`nginx-hostname`). Resolvers receive `{ subdomain, user }`.
- Prefix every GraphQL type with `__Pascal__` and every operation and root
  field with `__camel__`; the supergraph is shared by all plugins.
- `ui/src/config.tsx` exports `CONFIG`; `ui/src/Main.tsx` exports `__Pascal__`.
  Keep both expose names in `ui/rspack.config.ts` in sync with `erxes.json`.

## Rules

- No `any`; named exports (default export only where a tool requires it, e.g.
  `rspack.config.ts`).
- `react`, `react-dom`, `react-router`, `@apollo/client` stay `ui`
  devDependencies and `import: false` shared singletons: the host provides them.
- UI classes use the `__twPrefix__:` Tailwind prefix and the host tokens
  (`bg-background`, `text-muted-foreground`, `border-border`, …).
- Authorize in the API using `context.user`; the UI route guard is not a
  security boundary.
- Every query has loading, error and empty states; refetch or update the
  Apollo cache after each mutation.
