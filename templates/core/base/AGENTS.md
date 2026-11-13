# __title__

An erxes plugin for the new core (Postgres). `api/` is the API: Express 5,
oRPC and Drizzle. `ui/` is the Module Federation remote core-ui loads. Read the
`AGENTS.md` in the folder you edit.

- Gates: `pnpm check` (format, lint, types), `pnpm test` (real Postgres via
  `DATA_TEST_URL`), `pnpm build`. `pnpm fix` formats and fixes lint.
- Core finds the plugin by these names, so they stay fixed: plugin `__id__`,
  remote `__id___ui` exposing `./config` and `./__id__`, pages under `/__id__/*`.
- Every table, index and constraint starts with `__id___`, and every table has
  `org_id` with row-level security. Core and other plugins share the database.
- The plugin reaches core only through `@erxes/plugin-sdk` (`api/src/core.ts`)
  and the UI's `pluginFetch`. It never reads `core_*` tables or imports core code.
- Members are signed in by core: the UI sends a session token, the API checks it
  with `verifyPluginSession`. There is no public route yet, because core can't
  tell a public request's organisation.
- Skills in `.agents/skills/`: `endpoint` for a procedure, `schema-change` for a
  table or column, `verify` before calling a change done.__migrationSkill__
- Core's own rules for plugins are its `plugin-new` skill (erxes repo, branch
  `postgre`, `.agents/skills/plugin-new/SKILL.md`).
