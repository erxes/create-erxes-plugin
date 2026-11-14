-- Core's tenant functions (erxes packages/db/drizzle), which plugin migrations
-- call. Tests and tools/check-rls.sh install them in their throwaway databases.
CREATE OR REPLACE FUNCTION core_tenant_visible(p_org_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_org_id = current_setting('app.org_id', true)
      OR coalesce(current_setting('app.system', true), '') = 'on'
$$;
CREATE OR REPLACE FUNCTION core_enable_tenant_rls(p_table regclass, p_column text DEFAULT 'org_id') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_column !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'core_enable_tenant_rls: invalid column %', p_column;
  END IF;
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS tenant ON %s', p_table);
  EXECUTE format('CREATE POLICY tenant ON %s USING (core_tenant_visible(%I)) WITH CHECK (core_tenant_visible(%I))', p_table, p_column, p_column);
END $$;
