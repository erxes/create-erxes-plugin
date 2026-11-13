import { ORPCError } from '@orpc/server';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { PERMISSIONS } from '#/core.ts';
import { items } from '#/db/schema.ts';
import { reads, writes } from '#/orpc.ts';

const Fields = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
});

const escapeLike = (text: string) => text.replaceAll(/[\\%_]/g, '\\$&');

/** Newest first, in pages: `nextCursor` is the id to pass for the next page. */
const list = reads(PERMISSIONS.view)
  .input(
    z.object({
      search: z.string().trim().max(200).optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input, context: { tx, member } }) => {
    const after = input.cursor
      ? sql`(${items.createdAt}, ${items.id}) < (select created_at, id from ${items} where id = ${input.cursor})`
      : undefined;

    const rows = await tx
      .select()
      .from(items)
      .where(
        and(
          eq(items.orgId, member.orgId),
          input.search ? ilike(items.name, `%${escapeLike(input.search)}%`) : undefined,
          after,
        ),
      )
      .orderBy(desc(items.createdAt), desc(items.id))
      .limit(input.limit + 1);

    const page = rows.slice(0, input.limit);

    return {
      items: page,
      nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
    };
  });

const create = writes(PERMISSIONS.manage)
  .input(Fields.partial({ description: true }))
  .handler(async ({ input, context: { tx, member } }) => {
    const [item] = await tx
      .insert(items)
      .values({ ...input, orgId: member.orgId, createdBy: member.userId })
      .returning();

    if (!item) throw new ORPCError('INTERNAL_SERVER_ERROR');

    return item;
  });

const update = writes(PERMISSIONS.manage)
  .input(Fields.partial().extend({ id: z.string() }))
  .handler(async ({ input: { id, ...fields }, context: { tx, member } }) => {
    const [item] = await tx
      .update(items)
      .set(fields)
      .where(and(eq(items.id, id), eq(items.orgId, member.orgId)))
      .returning();

    if (!item) throw new ORPCError('NOT_FOUND', { message: 'No such item' });

    return item;
  });

export const itemProcedures = { list, create, update };
