import test from 'node:test';
import assert from 'node:assert/strict';
import { EntitlementCache } from '../src/core/entitlement-cache.js';
import { MemoryStorage } from './helpers.js';

test('entitlement cache is tied to user and expires after three days', () => {
  const clock = { value: new Date('2026-09-20T12:00:00Z') };
  const cache = new EntitlementCache({ storage: new MemoryStorage(), now: () => clock.value });
  const account = { userId: 8 };
  cache.save(account, { is_vip: true, expired_at: '2026-10-20T00:00:00Z' });
  assert.equal(cache.load(account).is_vip, true);
  assert.equal(cache.load({ userId: 9 }), null);
  clock.value = new Date('2026-09-24T12:00:00Z');
  assert.equal(cache.load(account), null);
});

test('expired or non-member data is never accepted as cached entitlement', () => {
  const storage = new MemoryStorage();
  const now = () => new Date('2026-09-20T12:00:00Z');
  const cache = new EntitlementCache({ storage, now });
  const account = { userId: 8 };
  cache.save(account, { is_vip: false });
  assert.equal(cache.load(account), null);
  cache.save(account, { is_vip: true, expired_at: '2026-09-19T12:00:00Z' });
  assert.equal(cache.load(account), null);
});

