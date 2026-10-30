import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  readCurrentRefreshVersion,
  runRefreshWithLock,
  runWithRefreshLock,
} from '../src/lib/auth-refresh-coordination.ts';

class FakeLockManager {
  #queue = Promise.resolve();

  request(_name, callback) {
    const result = this.#queue.then(callback);
    this.#queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installBrowserMocks() {
  const values = new Map();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: new FakeLockManager() },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  });
}

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  } else {
    delete globalThis.navigator;
  }

  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test('a stale 401 waits for login, then skips refresh and retries with the login cookies', async () => {
  installBrowserMocks();
  const staleVersion = readCurrentRefreshVersion();

  let finishLogin;
  let loginStarted;
  const loginStartedPromise = new Promise((resolve) => {
    loginStarted = resolve;
  });
  const login = runWithRefreshLock(async () => {
    loginStarted();
    await new Promise((resolve) => {
      finishLogin = resolve;
    });
    return 'logged-in';
  });

  await loginStartedPromise;
  let refreshCalls = 0;
  const staleRefresh = runRefreshWithLock(staleVersion, async () => {
    refreshCalls += 1;
  });

  finishLogin();
  assert.equal(await login, 'logged-in');
  await staleRefresh;

  assert.equal(refreshCalls, 0);
  assert.notEqual(readCurrentRefreshVersion(), staleVersion);
});

test('a current refresh version permits one refresh and advances the marker', async () => {
  installBrowserMocks();
  const expectedVersion = readCurrentRefreshVersion();
  let refreshCalls = 0;

  await runRefreshWithLock(expectedVersion, async () => {
    refreshCalls += 1;
  });

  assert.equal(refreshCalls, 1);
  assert.notEqual(readCurrentRefreshVersion(), expectedVersion);
});

test('a refresh failure settles before a queued login can issue its cookies', async () => {
  installBrowserMocks();
  let cookies = 'old-cookie';
  let finishRefresh;
  let refreshStarted;
  const refreshStartedPromise = new Promise((resolve) => {
    refreshStarted = resolve;
  });

  const refresh = runRefreshWithLock(null, async () => {
    refreshStarted();
    await new Promise((resolve) => {
      finishRefresh = resolve;
    });
    cookies = null; // Models the backend clearing cookies on rejected refresh.
    throw new Error('invalid or expired session');
  });

  await refreshStartedPromise;
  let loginStarted = false;
  const login = runWithRefreshLock(async () => {
    loginStarted = true;
    cookies = 'new-login-cookie';
  });

  assert.equal(loginStarted, false);
  finishRefresh();
  await assert.rejects(refresh, /invalid or expired session/);
  await login;

  assert.equal(loginStarted, true);
  assert.equal(cookies, 'new-login-cookie');
});
