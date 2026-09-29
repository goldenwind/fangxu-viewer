import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipValidity, planComparison, planKind, priceText } from '../src/membership/helpers.js';

test('membership prices and plan kinds remain data driven', () => {
  assert.equal(priceText('9.90'), '9.9');
  assert.equal(priceText(0), '0');
  assert.equal(planKind({ product_code: 'APP_VIP_YEAR' }), 'year');
  assert.deepEqual(planComparison(
    { product_code: 'APP_VIP_YEAR', price: 39 },
    [{ product_code: 'APP_VIP_MONTH', price: 9.9 }],
  ), ['按月购买 12 个月 ¥118.8', '省 ¥79.8']);
});

test('lifetime membership has no expiry', () => {
  assert.deepEqual(membershipValidity({ vip_type: 'lifetime' }), ['会员有效期', '永久有效 · 无到期时间']);
});

