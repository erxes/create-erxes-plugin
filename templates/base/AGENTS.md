# __name__

__description__

An erxes plugin outside the erxes monorepo: `api/` (__runtime__,
__backendHint__) and `ui/` (React 18 Module Federation remote). `erxes.json`
is the single source of the plugin's identity and ports.

## Commands

- `__pm__ install`
- `__pmRun__ dev:api` / `__pmRun__ dev:ui`
- `__pmRun__ codegen`
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

__apiContracts__
- Prefix every GraphQL type with `__Pascal__` and every operation and root
  field with `__camel__`; the supergraph is shared by all plugins.
- `ui/src/config.tsx` exports `CONFIG`; `ui/src/Main.tsx` exports `__Pascal__`;
  `ui/src/Settings.tsx` exports `__Pascal__Settings`;
  `ui/src/widgets/NotificationWidget.tsx` exports `NotificationWidget` for the
  `./notificationWidget` inbox expose. Keep the expose names in
  `ui/rspack.config.ts` in sync with `erxes.json`.
- __schemaPrint__.
- `erxes-ui`, `ui-modules` and `erxes-api-shared` are the npm packages
  `@erxes/ui`, `@erxes/ui-modules` and `@erxes/api-shared`, installed under
  those import names with npm aliases; keep them on the versions your erxes
  deployment pins.

## Rules

- No `any`; named exports (default export only where a tool requires it, e.g.
  `rspack.config.ts`).
- The `hostShared` list in `ui/rspack.config.ts` (`react`, `react-dom`,
  `react-router`, `react-router-dom`, `@apollo/client`, `jotai`,
  `react-i18next`, `erxes-ui`, `ui-modules`) mirrors core-ui's shared
  singletons: they stay `import: false` and are never bundled — the host
  provides them at runtime. Keep the list in sync with core-ui's
  `coreLibraries`.
- `erxes-ui`/`ui-modules` imports resolve to the shared singleton at runtime,
  so the installed versions should match the host's — they only decide what
  TypeScript and Rspack resolve against.
- UI classes use the `__twPrefix__:` Tailwind prefix and the host tokens
  (`bg-background`, `text-muted-foreground`, `border-border`, …).
- Authorize in the API using `context.user`; the UI route guard is not a
  security boundary.
- Every query has loading, error and empty states; refetch or update the
  Apollo cache after each mutation.
- GraphQL documents are `gql()` from `~/gql` — generated into `ui/src/gql/`
  by `codegen` from `api/generated/schema.graphql` — written as a function
  call on a static string with no `${}` interpolation.
- Apollo hooks infer their types from the document: no `useQuery<T>` or
  `useMutation<T>` generics and no handwritten response interfaces; derive
  types from the generated `*Query` types.
- `api/generated` and `ui/src/gql` are gitignored; `check`, `build` and
  `dev:ui` run `codegen` first. Run `__pmRun__ codegen` after changing a
  document or the schema.
