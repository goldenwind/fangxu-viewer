import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  getInstallationId,
  isSkippedVersion,
  skipVersion,
} from '../src/update/helpers.js';
import { MemoryStorage } from './helpers.js';

test('installation id is generated once and remains stable', () => {
  const storage = new MemoryStorage();
  const cryptoApi = { randomUUID: () => 'installation-123' };
  assert.equal(getInstallationId(storage, cryptoApi), 'installation-123');
  assert.equal(getInstallationId(storage, { randomUUID: () => 'other' }), 'installation-123');
});

test('only the explicitly skipped version is suppressed', () => {
  const storage = new MemoryStorage();
  skipVersion('1.2.0', storage);
  assert.equal(isSkippedVersion('1.2.0', storage), true);
  assert.equal(isSkippedVersion('1.3.0', storage), false);
});

test('download sizes are formatted for the update dialog', () => {
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(12 * 1024 * 1024), '12 MB');
});
