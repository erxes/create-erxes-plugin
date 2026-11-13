import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll } from 'vite-plus/test';

// Runs before each test file: a throwaway database owned by a role without
// BYPASSRLS, like the plugin role core creates, migrated from drizzle/.
const adminUrl = process.env.DATA_TEST_URL;

if (!adminUrl) {
  throw new Error(
    'Set DATA_TEST_URL to a Postgres superuser, e.g. postgres://postgres:postgres@127.0.0.1:5432/postgres',
  );
}

const ROLE = '__id___test';
const database = `__id___test_${randomBytes(4).toString('hex')}`;

// Core's tenant functions (erxes packages/db/drizzle), which plugin migrations call.
const CORE_FUNCTIONS = `
CREATE OR REPLACE FUNCTION core_tenant_visible(p_org_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_org_id = current_setting('app.org_id', true)
      OR coalesce(current_setting('app.system', true), '') = 'on'
$$;
CREATE OR REPLACE FUNCTION core_enable_tenant_rls(p_table regclass, p_column text DEFAULT 'org_id') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS tenant ON %s', p_table);
  EXECUTE format('CREATE POLICY tenant ON %s USING (core_tenant_visible(%I)) WITH CHECK (core_tenant_visible(%I))', p_table, p_column, p_column);
END $$;
`;

const urlOf = (name: string, role?: string) => {
  const url = new URL(adminUrl);

  url.pathname = `/${name}`;

  if (role) {
    url.username = role;
    url.password = role;
  }

  return url.toString();
};

const run = async (url: string, statement: string) => {
  const client = new pg.Client({ connectionString: url });

  await client.connect();

  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
};

await run(
  adminUrl,
  `DO $$ BEGIN CREATE ROLE ${ROLE} LOGIN NOBYPASSRLS PASSWORD '${ROLE}';
   EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`,
);
await run(adminUrl, `CREATE DATABASE ${database} OWNER ${ROLE}`);
await run(urlOf(database), CORE_FUNCTIONS);

process.env.DATA_URL = urlOf(database, ROLE);

const { runMigrations } = await import('#/db/migrate.ts');

await runMigrations();

afterAll(async () => {
  const { pool } = await import('#/db/client.ts');

  await pool.end();
  await run(adminUrl, `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
});
