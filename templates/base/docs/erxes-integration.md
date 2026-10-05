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

__apiRegistration__

The gateway only composes plugins listed in its `ENABLED_PLUGINS`.

## UI loading

1. core-api `GET /get-frontend-plugins` returns `{ name: "__remote__", entry }`
   for each enabled plugin. `entry` is the registered `uiEntry`, or
   `https://plugins.erxes.io/<releaseVersion>/__name___ui/remoteEntry.js`.
2. core-ui loads `__remote__/config` and reads the exported `CONFIG`.
3. core-ui routes `/<CONFIG.path>/*` to `__remote__/<CONFIG.name>` and
   `/settings/<CONFIG.path>/*` to `__remote__/<CONFIG.name>Settings`,
   rendering each expose's PascalCase export (`__Pascal__`, `__Pascal__Settings`).
   A third expose, `__remote__/notificationWidget`, renders
   `__name__:<module>.<action>` notifications in the inbox — it receives the
   `TNotification` object as props and is resolved by the named export
   `NotificationWidget`.
4. The `hostShared` list in `ui/rspack.config.ts` — `react`, `react-dom`,
   `react-router`, `react-router-dom`, `@apollo/client`, `jotai`,
   `react-i18next`, `erxes-ui` and `ui-modules` — mirrors core-ui's
   `coreLibraries` singletons, so the page runs inside core-ui's router,
   ApolloProvider, i18n and design system with the user's auth cookie. The
   remote never bundles them.

core-api sends a `__name__:system.welcome` notification to every user when the
plugin is enabled; core-ui renders that one itself. Every other notification
your API sends with contentType `__name__:<module>.<action>` opens in the
inbox and renders through `ui/src/widgets/NotificationWidget.tsx`.

core-ui in development also registers remotes it gets from
`/get-frontend-plugins`, so `pnpm dev:uis` in erxes plus `__pmRun__ dev:ui`
here is enough.

## Shared libraries

`erxes-ui` and `ui-modules` — plus `erxes-api-shared` on the platform stack —
live inside the erxes monorepo and are not on npm. This repo consumes them as
git dependencies on monorepo subdirectories:

```jsonc
// ui/package.json
"erxes-ui":   "__erxesUiDep__",
"ui-modules": "__erxesUiModulesDep__"
```

```jsonc
// api/package.json (platform stack)
"erxes-api-shared": "__erxesApiSharedDep__"
```

Notes:

- The `#__erxesRef__` ref is what your plugin compiles and type-checks
  against. Pin it to the commit your erxes deployment runs — the host provides
  `erxes-ui`/`ui-modules` as Module Federation singletons at runtime, so a
  type/runtime mismatch surfaces as broken imports, not as a helpful error.
- pnpm resolves `&path:` monorepo subdirectories in git deps. The other
  package managers get a `file:../erxes/...` fallback instead — adjust the
  path if your erxes clone does not sit next to this repo. `file:` specs do
  not run `prepare`, so run `pnpm install` in the erxes clone once first —
  its workspace install builds each library's `dist/` declarations and
  bundles.
- `erxes-api-shared` runs its `prepare` (preconstruct build) on install, which
  is what produces its `dist/` bundles; `erxes-ui` and `ui-modules` emit
  `dist/` type declarations the same way. With `dist/` present, `tsc`
  type-checks the plugin against declarations only — the libraries' own
  source is never re-checked against this repo's dependency versions.
- When erxes publishes these libraries to npm, swap the git/file specifiers
  for version ranges and nothing else changes.

## Styling

core-ui ships Tailwind preflight and unprefixed utilities for its own code.
This remote compiles its own utilities with the `__twPrefix__:` prefix
(`ui/src/styles.css`), mapped to the host's design tokens (`--background`,
`--muted-foreground`, …). The prefix keeps the plugin's CSS from overriding
the host or other plugins. `erxes-ui` components come pre-styled by the host's
own CSS — no extra setup needed.

## Permissions

core-ui guards the route with `hasPluginPermission(CONFIG.name)`, which only
restricts plugins that core-api lists in `pluginsWithPermissions`, i.e. plugins
whose registered `meta.permissions` declares modules or default groups. That
list holds the plugin `name` (`__name__`) while the guard checks `CONFIG.name`
(`__id__`); for a dashed name they differ and the route guard never blocks.
Enforce access in the API resolvers, never only in the UI.
