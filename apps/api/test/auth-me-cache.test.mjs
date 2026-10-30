import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { get } from 'node:http';
import { test } from 'node:test';

import { authMeNoStoreMiddleware } from '../src/auth/auth-me-cache.middleware.ts';

const requireFromApi = createRequire(new URL('../package.json', import.meta.url));
const requireFromNestPlatform = createRequire(
  requireFromApi.resolve('@nestjs/platform-express'),
);
const express = requireFromNestPlatform('express');
const ME_PATH = '/api/v1/auth/me';

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = get(url, { headers, agent: false }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: body ? JSON.parse(body) : undefined,
        });
      });
    });
    request.on('error', reject);
  });
}

async function startMeServer({ middleware = true, session } = {}) {
  const app = express();

  if (middleware === true) {
    app.use(ME_PATH, authMeNoStoreMiddleware);
  } else if (middleware === 'no-store-only') {
    app.use(ME_PATH, (_request, response, next) => {
      response.setHeader('Cache-Control', 'no-store');
      next();
    });
  }

  app.get(ME_PATH, (request, response) => {
    // This represents the per-request authenticated-session check performed
    // by JwtAuthGuard/JwtStrategy before the real controller handler runs.
    session.checks += 1;

    if (session.revoked) {
      response.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid or expired session.',
        errors: [],
        path: request.path,
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: { userId: session.userId },
    });
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}${ME_PATH}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

test('normal /auth/me response preserves the envelope and is no-store', async () => {
  const session = { userId: 'user-1', revoked: false, checks: 0 };
  const server = await startMeServer({ session });

  try {
    const response = await httpGet(server.url);

    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, {
      success: true,
      data: { userId: 'user-1' },
    });
  } finally {
    await server.close();
  }
});

test('no-store alone does not stop Express from returning 304 for a matching ETag', async () => {
  const server = await startMeServer({
    middleware: 'no-store-only',
    session: { userId: 'user-1', revoked: false, checks: 0 },
  });

  try {
    const first = await httpGet(server.url);
    assert.equal(first.status, 200);
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.ok(first.headers.etag);

    const conditional = await httpGet(server.url, {
      'If-None-Match': first.headers.etag,
    });
    assert.equal(conditional.status, 304);
  } finally {
    await server.close();
  }
});

test('If-None-Match cannot skip the fresh session check after a user change or revocation', async () => {
  const session = { userId: 'user-1', revoked: false, checks: 0 };
  const server = await startMeServer({ session });

  try {
    const first = await httpGet(server.url);
    assert.equal(first.status, 200);
    assert.ok(first.headers.etag);

    session.userId = 'user-2';
    const changed = await httpGet(server.url, {
      'If-None-Match': first.headers.etag,
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.headers['cache-control'], 'no-store');
    assert.deepEqual(changed.body, {
      success: true,
      data: { userId: 'user-2' },
    });

    session.revoked = true;
    const revoked = await httpGet(server.url, {
      'If-None-Match': changed.headers.etag,
    });
    assert.equal(revoked.status, 401);
    assert.equal(revoked.headers['cache-control'], 'no-store');
    assert.equal(session.checks, 3);
  } finally {
    await server.close();
  }
});
