import type { PluginMember } from '@erxes/plugin-sdk';
import { call } from '@orpc/server';
import { describe, expect, it } from 'vite-plus/test';
import { PERMISSIONS } from '#/core.ts';
import { router } from '#/router.ts';

const memberOf = (orgId: string, permissions: string[]): PluginMember => ({
  userId: `user-${orgId}`,
  orgId,
  role: 'member',
  permissions,
  can: (action) => permissions.includes(action),
  tier: 'pro',
  access: 'full',
  canChange: () => true,
});

const manager = (orgId: string) => ({
  context: { member: memberOf(orgId, [PERMISSIONS.view, PERMISSIONS.manage]) },
});

describe('items', () => {
  it('creates, lists newest first in pages, and updates', async () => {
    const first = await call(router.items.create, { name: 'First' }, manager('org-a'));
    const second = await call(router.items.create, { name: 'Second' }, manager('org-a'));

    expect(first).toMatchObject({ name: 'First', description: '', createdBy: 'user-org-a' });

    const page = await call(router.items.list, { limit: 1 }, manager('org-a'));

    expect(page.items.map((item) => item.id)).toEqual([second.id]);
    expect(page.nextCursor).toBe(second.id);

    const next = await call(router.items.list, { limit: 1, cursor: second.id }, manager('org-a'));

    expect(next.items.map((item) => item.id)).toEqual([first.id]);
    expect(next.nextCursor).toBeNull();

    const updated = await call(
      router.items.update,
      { id: first.id, description: 'Changed' },
      manager('org-a'),
    );

    expect(updated).toMatchObject({ name: 'First', description: 'Changed' });
  });

  it('shows each organisation only its own items', async () => {
    const theirs = await call(router.items.create, { name: 'Theirs' }, manager('org-b'));
    const ours = await call(router.items.list, {}, manager('org-c'));

    expect(ours.items).toEqual([]);
    await expect(
      call(router.items.update, { id: theirs.id, name: 'Mine now' }, manager('org-c')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses members without the permission', async () => {
    const viewer = { context: { member: memberOf('org-d', [PERMISSIONS.view]) } };

    await expect(call(router.items.create, { name: 'No' }, viewer)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(call(router.items.list, {}, viewer)).resolves.toMatchObject({ items: [] });
  });
});
