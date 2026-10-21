# Backend Authentication and Request Security

**Status: Implementation checkpoint before frontend integration.** The backend Authentication routes and session handling described here are present in the current source. The React application is still the Vite starter and does not yet contain an Authentication client. This checkpoint does not mark the Authentication milestone or Sprint 1 Epic complete, and it does not claim production readiness.

## Request routes

The application combines the global `/api` prefix with URI version `1`; the routes below are therefore exposed under `/api/v1`.

| Method and route             | Access                                                                       | Behavior and response                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register` | Public; limited to 5 requests per 60 seconds                                 | Validates registration input, creates an account, and returns its public profile in the standard success envelope. It does not set authentication cookies.                    |
| `POST /api/v1/auth/login`    | Public; limited to 5 requests per 60 seconds                                 | Verifies credentials for an active account, creates a session, sets access and refresh cookies, and returns the public user profile. Raw tokens are not in the JSON body.     |
| `POST /api/v1/auth/refresh`  | Public route using the refresh cookie; limited to 10 requests per 60 seconds | Validates and rotates the refresh token, sets replacement access and refresh cookies, and returns the public user profile. Unauthorized refresh responses clear both cookies. |
| `POST /api/v1/auth/logout`   | Requires `JwtAuthGuard`                                                      | Revokes the current database session, clears both cookies, and returns a success message.                                                                                     |
| `GET /api/v1/auth/me`        | Requires `JwtAuthGuard`                                                      | Returns the authenticated `userId` in the standard success envelope.                                                                                                          |

Routes without a method-specific throttle override use the configured global limit. Statuses are 201 for registration and 200 for login, refresh, logout, and `me`.

## Authentication flow and boundaries

### Registration and user profiles

`RegisterDto` trims email and username; the `UsersService` trims and lowercases both values before lookup and persistence. The DTO validates email syntax, a 255-character registration email limit, a 3–30 character ASCII alphanumeric/underscore username, and a password of 8–128 characters that includes uppercase, lowercase, a number, and a symbol. Login currently caps email at 255 characters and password at 128; the differing email limits should be aligned if 255-character addresses are intended to be accepted.

`AuthService` checks for duplicate normalized email and username before hashing. The database unique indexes remain authoritative if two registrations race; the global exception filter maps Prisma unique conflicts to a generic 409 response. Passwords are hashed with Argon2id. Responses pass through `UsersService` profile mapping, which excludes `passwordHash`; authentication lookups retain the hash only for credential verification.

For login, the password service creates a dummy Argon2id hash when the module initializes and verifies against it when no stored hash is available. This reduces the timing difference between unknown and known accounts but does not guarantee constant-time behavior for the full request path. Invalid credentials, inactive accounts, and unavailable password hashes use a generic authentication error.

### Access and refresh tokens

`AuthService` issues a signed JWT containing `sub` (user ID) and `sid` (session ID). `JWT_ACCESS_TTL_SECONDS` controls its lifetime. `JwtStrategy` extracts the access token only from the `access_token` cookie, verifies the signature and expiration, validates that both claims are non-empty strings, then calls `SessionRepository.findActiveSession()`. PostgreSQL must still show the matching user/session as active, unrevoked, and unexpired. The strategy returns only `userId` and `sessionId` as trusted request identity. `JwtAuthGuard` is applied to `logout` and `me`; those are the only current Authentication routes requiring that guard.

| Cookie          | Flags and scope                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_token`  | `HttpOnly`, `SameSite=Lax`, expires with the access JWT, path `/api/v1`. `Secure` is true when `NODE_ENV=production`; otherwise false.         |
| `refresh_token` | `HttpOnly`, `SameSite=Lax`, expires with the refresh token, path `/api/v1/auth`. `Secure` is true when `NODE_ENV=production`; otherwise false. |

Login and refresh set cookies and return profile data, not raw tokens, in JSON. Logout revokes the current `Session` for the authenticated user/session pair before clearing cookies with matching paths and flags. Clearing cookies alone would not revoke the server-side session.

Refresh tokens are generated from cryptographically random bytes and stored in PostgreSQL as SHA-256 hashes. A refresh request hashes the presented cookie, checks token/session expiration, revocation, account status, and consumption state, then signs the new access token before rotation. Expired refresh tokens are rejected without revoking a session even if `consumedAt` is set. Reuse of an unexpired consumed token still revokes the session and returns the generic authentication error.

`PrismaSessionRepository` performs rotation in a transaction. It conditionally consumes only an unconsumed, unexpired token, creates its replacement in the same transaction, and updates the session’s last-used time to serialize refresh operations against session revocation. The partial unique index prevents more than one unconsumed refresh-token row per session. When a replay is detected inside the transaction, the repository returns a result normally so revocation commits before the service raises an unauthorized response. Failure to create the replacement rolls back token consumption.

### Persistence responsibilities

| Component                                       | Responsibility                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UsersService` / `UserRepository`               | Normalize identity values, perform user lookups and creation, and map records to public profiles. `PrismaUserRepository` owns the Prisma queries. |
| `AuthService`                                   | Coordinate registration, password checks, session/token issuance and refresh, and logout.                                                         |
| `PasswordHasherService` / `RefreshTokenService` | Hash and verify passwords; generate refresh tokens and hash them for storage.                                                                     |
| `SessionRepository` / `PrismaSessionRepository` | Define the session persistence boundary and implement its PostgreSQL queries and rotation transaction.                                            |

The current schema has seven core-domain models plus `Session` and `SessionRefreshToken`. A user can have multiple sessions. `Session` records user, expiration, creation, last-use, and revocation timestamps. `SessionRefreshToken` records the owning session, hash, creation/expiration, and optional consumption timestamp. The migration uses foreign keys with `ON DELETE RESTRICT`, a unique token-hash index, and the partial unique index `sessionId WHERE consumedAt IS NULL`. These database rules enforce referential integrity, token-hash uniqueness, and at most one unconsumed token per session; token expiry, active-session validity, and replay policy are application checks rather than additional database constraints.

## Request pipeline and security controls

`AppModule` loads `ConfigModule` globally with Joi validation, configures `RedisModule` globally with a client from `REDIS_URL`, configures `ThrottlerModule` to use that client for Redis storage, imports the database/users/auth modules, and registers global `OriginGuard` and `ThrottlerGuard` providers. Each API process connects to the configured Redis service; multiple processes share counters when they point to the same Redis deployment.

`main.ts` applies the global `/api` prefix, URI version `1`, cookie-parser, and a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform`. Successful handler results are wrapped as `{ success: true, data }` by the response interceptor. The exception filter returns `{ success: false, statusCode, message, errors, timestamp, path }` and keeps unknown 5xx responses generic while logging the server-side exception stack.

These controls serve different purposes:

| Control                        | What it does                                                                                                                                                                                                                          | What it does not do                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS                           | Allows browser JavaScript from the single configured `WEB_ORIGIN` and enables credentialed requests.                                                                                                                                  | It does not authorize a user or by itself prevent CSRF.                                                                                                                                             |
| `OriginGuard`                  | Globally requires the request `Origin` to match the normalized configured `WEB_ORIGIN` for methods other than `GET`, `HEAD`, and `OPTIONS`. Configure `WEB_ORIGIN` as an origin only (scheme, host, and optional port), with no path. | It is not a complete substitute for a deployment-specific CSRF policy; safe methods are exempt, and non-browser clients without an Origin header cannot call unsafe routes as currently configured. |
| `JwtStrategy` / `JwtAuthGuard` | Verifies the access JWT and the associated user/session against PostgreSQL for guarded routes.                                                                                                                                        | A valid JWT alone does not bypass the database session and account-state checks.                                                                                                                    |
| `ThrottlerGuard`               | Enforces configured global and route-specific request limits using Redis-backed counters.                                                                                                                                             | Rate limiting is not authentication and does not replace account-abuse monitoring or other controls.                                                                                                |

Cookie-authenticated state changes need deployment-specific review of CSRF defenses, allowed origins, HTTPS, proxy behavior, and `SameSite` settings. CORS and the current Origin guard provide useful checks but must not be documented as proof of production security.

## Status / Remaining Work

### Implemented

- Backend routes, DTO validation, normalized user creation, Argon2id hashing, dummy verification for unknown accounts, JWT cookie authentication, PostgreSQL sessions, refresh rotation, logout revocation, and guarded `me` lookup.
- Global request validation, response/error envelopes, credentialed CORS, cookie parsing, Origin guard, and Redis-backed throttling.

### Locally verified

- The manual local shared-rate-limit check recorded for this checkpoint returned `PONG` from Redis and showed a Redis key with the `_throttler:` prefix after an API request.
- Two local API instances were started on ports 3000 and 3001. Six registration requests from the same client were alternated across them within one minute. The first five reached DTO validation and returned 400; the sixth returned 429 Too Many Requests. This verifies shared local counter behavior for that scenario only; it does not prove production scalability, resilience, or production readiness.
- Automated tests were deferred by agreement and were not run as part of the recent review. Existing test files do not cover the full HTTP, Redis sharing, or concurrency behavior described here.

### Remaining before milestone completion or production use

- Implement the frontend Authentication client. Cross-origin browser requests must include credentials (for example, `fetch` with `credentials: 'include'` or the equivalent client setting) so cookies are sent and accepted.
- Coordinate refresh attempts with client-side single-flight behavior. The backend retains strict replay detection: concurrent refreshes using one token or a lost refresh response followed by a retry can revoke the session and require the user to log in again. This policy is deliberate and is not solved by the local rate-limit verification.
- Add integration and concurrency tests for registration, login, cookies, logout, JWT/session validation, refresh rotation, replay, expiration, and rollback behavior before marking the Authentication milestone complete.
- Finalize deployment-specific CSRF, Origin, HTTPS, cookie, and trusted-proxy settings. Verify that the deployed frontend origin exactly matches `WEB_ORIGIN`.
- Validate production shared Redis availability/configuration, reverse-proxy and trusted-proxy behavior, and PostgreSQL connection pooling for a real multi-instance deployment.
- Define cleanup/retention for expired sessions and consumed refresh-token rows. Revisit login/registration throttling limits against product requirements.
- Resolve the email validation length difference between registration and login if needed.

This is an intermediate backend checkpoint before frontend integration, not closure of the Authentication milestone or Sprint 1 Epic.
