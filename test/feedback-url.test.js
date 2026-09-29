import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackUrl } from '../src/feedback/url.js';

test('feedback link uses the current product and keeps the token out of the request URL', () => {
  const url = new URL(createFeedbackUrl({
    baseUrl: 'https://api.ip21.cn/', productId: 8, apiToken: 'v1_123_a+b/=',
  }));
  assert.equal(url.origin, 'https://api.ip21.cn');
  assert.equal(url.pathname, '/products/8/feedback');
  assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('api_token'), 'v1_123_a+b/=');
});

test('feedback link rejects missing product or account and insecure remote hosts', () => {
  assert.throws(() => createFeedbackUrl({ baseUrl: 'https://api.ip21.cn', productId: 0, apiToken: 'token' }));
  assert.throws(() => createFeedbackUrl({ baseUrl: 'https://api.ip21.cn', productId: 8, apiToken: '' }));
  assert.throws(() => createFeedbackUrl({ baseUrl: 'http://api.ip21.cn', productId: 8, apiToken: 'token' }));
});
