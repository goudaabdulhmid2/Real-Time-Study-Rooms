const REFRESH_VERSION_KEY = 'real-time-study-rooms:auth-refresh-version';
export const REFRESH_LOCK_NAME = 'real-time-study-rooms:auth-refresh';

// Indicates that safe cross-tab refresh coordination is unavailable.
export class RefreshCoordinationUnavailableError extends Error {
  constructor() {
    super(
      'Automatic session refresh is unavailable because this browser does not support Web Locks.',
    );

    this.name = 'RefreshCoordinationUnavailableError';
  }
}

export function readCurrentRefreshVersion(): string | null {
  try {
    return localStorage.getItem(REFRESH_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeRefreshVersion(): void {
  try {
    localStorage.setItem(REFRESH_VERSION_KEY, crypto.randomUUID());
  } catch {
    // The operation already succeeded; a missing marker only weakens cross-tab deduplication.
  }
}

function withRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return operation();
  }

  return navigator.locks.request(REFRESH_LOCK_NAME, operation);
}

/** Serialize login cookie issuance with refreshes across same-origin tabs. */
export async function runWithRefreshLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
   return withRefreshLock(async () => {
    const result = await operation();
    
    writeRefreshVersion();
    return result;
   });

}

/** Refresh only if no login or refresh advanced the marker since request dispatch. */
export async function runRefreshWithLock(
  expectedVersion: string | null,
  refresh: () => Promise<unknown>,
): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new RefreshCoordinationUnavailableError();
  }

  await navigator.locks.request(REFRESH_LOCK_NAME, async () => {
    if (readCurrentRefreshVersion() !== expectedVersion) {
      return;
    }

    await refresh();
    writeRefreshVersion();
  });
}
