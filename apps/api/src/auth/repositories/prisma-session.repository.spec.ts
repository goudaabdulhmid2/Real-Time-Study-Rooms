import { PrismaSessionRepository } from './prisma-session.repository';
import type { PrismaService } from '../../database/prisma.service';

jest.mock(
  'src/database/prisma.service',
  () => ({ PrismaService: class PrismaService {} }),
  { virtual: true },
);

describe('PrismaSessionRepository.revokeSession', () => {
  const sessionId = 'session-uuid';
  const userId = 'user-uuid';
  const now = new Date('2026-10-30T12:00:00.000Z');

  function createRepository(rows: Array<{
    id: string;
    userId: string;
    revokedAt: Date | null;
  }>) {
    const updateMany = jest.fn(async ({
      where,
      data,
    }: {
      where: { id: string; userId: string };
      data: { revokedAt: Date };
    }) => {
      let count = 0;
      for (const row of rows) {
        if (row.id === where.id && row.userId === where.userId) {
          row.revokedAt = data.revokedAt;
          count += 1;
        }
      }
      return { count };
    });
    const prisma = { session: { updateMany } } as unknown as PrismaService;

    return {
      repository: new PrismaSessionRepository(prisma),
      updateMany,
    };
  }

  it('revokes only the session matching both its id and owner', async () => {
    const rows = [
      { id: sessionId, userId, revokedAt: null },
      { id: 'other-session-uuid', userId, revokedAt: null },
      { id: sessionId, userId: 'other-user-uuid', revokedAt: null },
    ];
    const { repository, updateMany } = createRepository(rows);

    await expect(repository.revokeSession({ sessionId, userId, now })).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: sessionId, userId },
      data: { revokedAt: now },
    });
    expect(rows).toEqual([
      { id: sessionId, userId, revokedAt: now },
      { id: 'other-session-uuid', userId, revokedAt: null },
      { id: sessionId, userId: 'other-user-uuid', revokedAt: null },
    ]);
  });

  it('reports when no matching session was updated', async () => {
    const rows = [{ id: sessionId, userId: 'different-user', revokedAt: null }];
    const { repository } = createRepository(rows);

    await expect(repository.revokeSession({ sessionId, userId, now })).resolves.toBe(false);
    expect(rows[0].revokedAt).toBeNull();
  });

  it('propagates database failures instead of reporting successful revocation', async () => {
    const failure = new Error('database unavailable');
    const prisma = {
      session: { updateMany: jest.fn().mockRejectedValue(failure) },
    } as unknown as PrismaService;
    const repository = new PrismaSessionRepository(prisma);

    await expect(repository.revokeSession({ sessionId, userId, now })).rejects.toBe(failure);
  });
});
