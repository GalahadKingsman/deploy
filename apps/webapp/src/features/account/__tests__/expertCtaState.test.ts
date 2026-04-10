import { test, expect } from 'vitest';
import { deriveExpertCtaState } from '../expertCtaState.js';
import type { ContractsV1 } from '@tracked/shared';

function sub(
  overrides: Partial<ContractsV1.ExpertSubscriptionV1>,
): ContractsV1.ExpertSubscriptionV1 {
  return {
    expertId: '00000000-0000-0000-0000-000000000001',
    plan: 'free_stub',
    status: 'inactive',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    priceCents: 0,
    ...overrides,
  };
}

test('deriveExpertCtaState: null/undefined → none', () => {
  expect(deriveExpertCtaState(null)).toBe('none');
  expect(deriveExpertCtaState(undefined)).toBe('none');
});

test('deriveExpertCtaState: status active, no end → active', () => {
  const subscription = sub({ status: 'active', currentPeriodEnd: null });
  expect(deriveExpertCtaState(subscription)).toBe('active');
});

test('deriveExpertCtaState: status active, end in future → active', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const subscription = sub({ status: 'active', currentPeriodEnd: future });
  expect(deriveExpertCtaState(subscription)).toBe('active');
});

test('deriveExpertCtaState: status active, end in past → expired', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const subscription = sub({ status: 'active', currentPeriodEnd: past });
  expect(deriveExpertCtaState(subscription)).toBe('expired');
});

test('deriveExpertCtaState: status inactive/expired → expired', () => {
  expect(deriveExpertCtaState(sub({ status: 'inactive' }))).toBe('expired');
  expect(deriveExpertCtaState(sub({ status: 'expired' }))).toBe('expired');
});
