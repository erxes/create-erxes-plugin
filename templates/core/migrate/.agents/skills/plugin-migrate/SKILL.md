---
name: plugin-migrate
description: Port the old erxes plugin this repo was made from onto the new core. Use when working through MIGRATION.md, porting a module, or when someone asks how far the migration is.
---

`MIGRATION.md` lists everything the old plugin did, one section per module.
`migration/inventory.json` holds the raw facts behind it, and
`migration/core-map.ts` says what each old core call becomes. Use synthetic
data only. The inventory reads code, never a database.

1. Read `MIGRATION.md`. Port the module with the fewest unticked items first;
   `Plugin-wide` goes last.
2. Tables. Move the module's tables from `migration/schema-draft.ts` into
   `api/src/db/schema.ts`, then follow the `schema-change` skill. Fix the draft
   types while moving: whole numbers become `integer()`, fixed string sets
   become `text({ enum })`, required ids stay `text().notNull()`. Drop columns
   nothing reads. Update the table's entry in `migration/import-map.ts` to
   match.
3. Procedures. One per GraphQL operation listed, following the `endpoint`
   skill. Name it after what it does (`tasks.list`, not `getTasks`), and fold
   operations that only differ by filter into one input. An operation the new
   UI never calls is ticked with no procedure.
4. Core calls. Do what the arrow says: `sdk` is
   `core.forOrg(orgId).<procedure>` in the API with that scope in
   `manifest.scopes`; `contract` is a call from the UI with the member's own
   session; `plugin-owned` lives in this plugin's tables or code.
5. Pages. One per UI route, under `ui/src/<module>/`, built from `erxes-ui`
   the way `ui/src/items/` is. The old `ui-modules` components don't exist
   here; rebuild them from `erxes-ui`.
6. Check parity in the browser, following the `verify` skill: open the old
   page and the new one side by side, and walk the same actions on both.
7. Tick each item that now works. An item marked **gap**, or one you find has
   no new-core equivalent, gets an issue in the plugin's repo that says what
   the old plugin did and what core would need. Tick it and end its line with
   `(filed <issue url>)`. Don't build a workaround.
8. Commit the module: schema, migration, procedures, page and the ticks
   together.
9. Copy data once all modules are in: `pnpm migrate:import` with `MONGO_URL`,
   `DATA_URL` and `ORG_ID` set. Its `Skipped` list must be empty or explained.

Rerun `pnpm migrate:inventory` and `pnpm migrate:checklist` only to pick up
new old-side code; ticks survive the rerun.

Done when every item in `MIGRATION.md` is ticked, each gap with its issue
link, and `pnpm check`, `pnpm test` and `pnpm build` pass.
