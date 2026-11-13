-- The tenancy guard, run by tools/check-rls.sh on a freshly migrated database.
-- Every row it returns is a problem; no rows means the schema passes.
--
-- 1. A table with org_id has row level security enabled and forced, and the
--    tenant policy core_enable_tenant_rls() makes: permissive, for all
--    commands, USING and WITH CHECK core_tenant_visible(org_id). Any other
--    permissive policy would let more rows through, so it fails too. This is
--    what lets withOrg() isolate organisations with no filter in the query.
-- 2. A table without org_id is in no_org_id, with the reason.
-- 3. Every table, index, sequence and view, and every table constraint,
--    starts with __id___: core and other plugins share the database.
with no_org_id (table_name, reason) as (
  values
    ('__drizzle_migrations___id__', 'The migration log (api/src/db/migrate.ts).')
),
relations as (
  select c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_toast%'
),
tables as (
  select r.*,
    exists (
      select 1 from pg_attribute a where a.attrelid = r.oid and a.attname = 'org_id' and not a.attisdropped
    ) as has_org_id,
    l.table_name is not null as listed
  from relations r
  left join no_org_id l on r.nspname = 'public' and l.table_name = r.relname
  where r.relkind in ('r', 'p', 'f')
),
tenant_tables as (
  select * from tables where has_org_id
),
policies as (
  select tt.oid, p.policyname,
    p.permissive = 'PERMISSIVE' as permissive,
    p.cmd = 'ALL'
      and p.qual = 'core_tenant_visible(org_id)'
      and p.with_check = 'core_tenant_visible(org_id)' as is_tenant_policy
  from tenant_tables tt
  join pg_policies p on p.schemaname = tt.nspname and p.tablename = tt.relname
)
select format('%s: %s', relname, concat_ws(', ',
  case when not relrowsecurity then 'row level security is off' end,
  case when not relforcerowsecurity then 'row level security is not forced' end,
  case when not exists (select 1 from policies p where p.oid = tt.oid and p.permissive and p.is_tenant_policy)
    then 'no tenant policy on core_tenant_visible(org_id): add SELECT core_enable_tenant_rls(...) to its migration' end))
from tenant_tables tt
where not (relrowsecurity and relforcerowsecurity
  and exists (select 1 from policies p where p.oid = tt.oid and p.permissive and p.is_tenant_policy))
union all
select format('%s: permissive policy %s is not the tenant check, so it lets more rows through', tt.relname, p.policyname)
from tenant_tables tt
join policies p on p.oid = tt.oid
where p.permissive and not p.is_tenant_policy
union all
select format('%s has no org_id: add it, or list the table in no_org_id with the reason', relname)
from tables
where not has_org_id and not listed
union all
select format('no_org_id lists %s, which %s', l.table_name,
  case when t.relname is null then 'does not exist' else 'has org_id' end)
from no_org_id l
left join tables t on t.nspname = 'public' and t.relname = l.table_name
where t.relname is null or t.has_org_id
union all
select format('%s %s does not start with __id___',
  case relkind when 'i' then 'index' when 'I' then 'index' when 'S' then 'sequence' when 'v' then 'view'
    when 'm' then 'materialized view' else 'table' end, relname)
from relations
where relkind in ('r', 'p', 'i', 'I', 'S', 'v', 'm', 'f')
  and not starts_with(relname, '__id___')
  and relname not in ('__drizzle_migrations___id__', '__drizzle_migrations___id___pkey', '__drizzle_migrations___id___id_seq')
union all
select format('constraint %s on %s does not start with __id___', co.conname, co.conrelid::regclass)
from pg_constraint co
join relations r on r.oid = co.conrelid
where not starts_with(co.conname, '__id___') and co.conrelid is distinct from to_regclass('public.__drizzle_migrations___id__')
order by 1;
