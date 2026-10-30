import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getPresentedRefreshToken } from '../src/auth/refresh-cookie.ts';

test('reads the refresh token value from parsed request cookies', () => {
  assert.equal(
    getPresentedRefreshToken({ refresh_token: 'opaque-token-value' }),
    'opaque-token-value',
  );
});

test('returns undefined when the refresh cookie is missing or malformed', () => {
  assert.equal(getPresentedRefreshToken(undefined), undefined);
  assert.equal(getPresentedRefreshToken({}), undefined);
  assert.equal(getPresentedRefreshToken({ refresh_token: ['not-a-cookie'] }), undefined);
  assert.equal(getPresentedRefreshToken({ refresh_token: '' }), undefined);
});
