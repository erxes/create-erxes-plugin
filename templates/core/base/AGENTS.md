# __title__

An erxes plugin for the new core (Postgres). `api/` is the API: Express 5,
oRPC and Drizzle. `ui/` is the Module Federation remote core-ui loads. Read the
`AGENTS.md` in the folder you edit. `api/src/modules/items` and `ui/src/items`
are the reference feature: copy their shape for a new one.

<!-- quality:start -->

## Quality

Every erxes repo on the new stack has this section, unchanged. The brackets name the checks that
enforce a rule; `review` marks the part no tool can check. The rewrite keeps every feature and improves the
architecture. Agents write the code and the checks judge it, so a green check lets a change ship
without line-by-line review.

- `pnpm check` is the type check: oxfmt, type-aware oxlint on tsrs and knip in about 10 s. Run it after each edit and before each commit; it replaces `tsc`. `pnpm fix` formats and autofixes. [pnpm check]
- Port what a feature does, not its code. Fix what the old code got wrong instead of carrying it over. [review]
- Use a maintained library when one does the job. Keep dependencies near their latest release and off deprecated APIs. [typescript/no-deprecated, review]
- One way to do each job. Search for the existing helper before writing one, merge the repeats you find, delete what nothing uses. [knip, review]
- Types flow from the database schema to the contract to the UI. Infer them, so each shape is written once. [pnpm check:generated, review]
- Parse outside input with zod and narrow it, so the code needs no `any`, cast or `!`. [typescript/no-explicit-any, typescript/no-unsafe-type-assertion, typescript/no-non-null-assertion]
- Lint and type rules are the spec: when one fires, fix the code. Silencing it is never the fix, whether by a disable comment, `@ts-ignore`, an override, an ignore, a weaker option or a raised limit. A rule that is wrong changes in its own PR. [typescript/ban-ts-comment, review]
- Split a file or function that outgrows its limit by responsibility (router, service, queries). [max-lines, max-lines-per-function, review]
- Finish the work in the change, with no TODO or FIXME left in code. [no-warning-comments]
- Tests call the public interface (HTTP, the typed client, the rendered page) and assert what it does, never source strings or code shapes. [review]
- Every test runs: a skipped test or an empty suite fails the run. A failing test gets its code or its wrong expectation fixed, never loosened or deleted. [pnpm test, review]
- Log through the structured logger, with the facts as fields. A caught error is rethrown or logged with its context. [no-console, review]
- Make the long-term change in one go, with no backward-compatibility shim, stopgap or speculative option. [review]
- Docs, PRs and copy are short: plain words, active voice, what it does or the number. [review]

<!-- quality:end -->

## This repo

- Gates: `pnpm check` (format, lint, types), `pnpm test` (real Postgres via
  `DATA_TEST_URL`), `pnpm build`. `pnpm fix` formats and fixes lint.
- Three checks the section names aren't here yet, so their rules are `[review]`
  in this repo: knip, `pnpm check:generated` (CI's migration drift check is the
  nearest), and `pnpm test` failing a skipped test.
- Core finds the plugin by these names, so they stay fixed: plugin `__id__`,
  remote `__id___ui` exposing `./config` and `./__id__`, pages under `/__id__/*`.
- Every table, index and constraint starts with `__id___`, and every table has
  `org_id` with forced row-level security. Core and other plugins share the
  database. [pnpm check:rls]
- The plugin reaches core only through `@erxes/plugin-sdk` (`api/src/core.ts`)
  and the UI's `pluginFetch`. It never reads `core_*` tables or imports core code.
- Members are signed in by core: the UI sends a session token, the API checks it
  with `verifyPluginSession`. There is no public route yet, because core can't
  tell a public request's organisation.
- Skills in `.agents/skills/`: `endpoint` for a procedure, `schema-change` for a
  table or column, `verify` before calling a change done.__migrationSkill__
- What core promises plugins, and what counts as a breaking change, is core's
  `plugin-contract` skill (erxes repo, branch `postgre`).
