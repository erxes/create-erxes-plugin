import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config, PLUGIN } from '#/config.ts';
import * as schema from './schema.ts';

export const pool = new pg.Pool({ connectionString: config.dataUrl, application_name: PLUGIN });

export const db = drizzle({ client: pool, schema, casing: 'snake_case' });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` in a transaction scoped to one organisation. Row-level security
 * shows nothing outside it, so every query that touches a table goes through
 * here. Services still filter by `orgId`; RLS is the safety net.
 */
export const withOrg = <T>(orgId: string, fn: (tx: Tx) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);

    return fn(tx);
  });
