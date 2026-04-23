import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContractsV1 } from '@tracked/shared';

describe('AddExpertTeamMemberByUserRequestV1Schema', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const courseId = '223e4567-e89b-12d3-a456-426614174001';

  it('accepts invite with at least one course', () => {
    const r = ContractsV1.AddExpertTeamMemberByUserRequestV1Schema.safeParse({
      userId,
      role: 'manager',
      courseIds: [courseId],
    });
    assert.strictEqual(r.success, true);
  });

  it('rejects empty courseIds', () => {
    const r = ContractsV1.AddExpertTeamMemberByUserRequestV1Schema.safeParse({
      userId,
      role: 'reviewer',
      courseIds: [],
    });
    assert.strictEqual(r.success, false);
  });

  it('parses extended team member row', () => {
    const r = ContractsV1.ExpertTeamMemberV1Schema.safeParse({
      userId,
      role: 'manager',
      createdAt: '2026-01-01T00:00:00.000Z',
      username: 'u1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.co',
      coursesLabel: '2 курса',
      lastActivityAt: '2026-01-02T00:00:00.000Z',
      isWorkspaceCreator: true,
    });
    assert.strictEqual(r.success, true);
  });
});
