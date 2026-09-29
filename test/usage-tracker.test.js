import test from 'node:test';
import assert from 'node:assert/strict';
import { UsageTracker } from '../src/core/usage-tracker.js';
import { AccessGate } from '../src/core/access-gate.js';
import { MemoryStorage } from './helpers.js';

test('free usage counts successful operations and resets next month', () => {
  const current = { value: new Date(2026, 8, 20) };
  const usage = new UsageTracker({ limit: 3, storage: new MemoryStorage(), now: () => current.value });
  assert.equal(usage.remaining, 3);
  usage.recordSuccess();
  usage.recordSuccess();
  usage.recordSuccess();
  assert.equal(usage.remaining, 0);
  current.value = new Date(2026, 9, 1);
  assert.equal(usage.remaining, 3);
});

test('access gate only records successful non-member operations', async () => {
  const usage = new UsageTracker({ limit: 1, storage: new MemoryStorage() });
  let blocked = 0;
  const gate = new AccessGate({ usage, isMember: () => false, onBlocked: () => { blocked += 1; } });
  await assert.rejects(() => gate.run(async () => { throw new Error('failed'); }));
  assert.equal(usage.remaining, 1);
  assert.deepEqual(await gate.run(async () => 'done'), { ok: true, value: 'done' });
  assert.equal(usage.remaining, 0);
  assert.deepEqual(await gate.run(async () => 'ignored'), { ok: false, reason: 'quota-exhausted' });
  assert.equal(blocked, 1);
});

test('member operations never consume local quota', async () => {
  const usage = new UsageTracker({ limit: 1, storage: new MemoryStorage() });
  const gate = new AccessGate({ usage, isMember: () => true, onBlocked: () => {} });
  await gate.run(async () => 'done');
  assert.equal(usage.remaining, 1);
});

