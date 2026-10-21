# Local Backend Development

This runbook describes local API configuration and the supporting PostgreSQL and Redis services. It documents the current environment schema and local Compose behavior; it does not include real credentials or secret values. No `.env.example` file is present in the repository, so configure a local `.env` in the API working directory and keep it out of version control.

## Start local services

From the repository root, start the database and Redis services:

```powershell
docker compose up -d postgres redis
```

The Compose file uses PostgreSQL 17, published on host port `5433` and container port `5432`, and Redis 7 Alpine, published on host loopback port `6379`. Redis is configured without RDB snapshots or AOF persistence and has no authentication configured in this local Compose service. Its data, including rate-limit counters, is ephemeral and may disappear when the service restarts; this is local development behavior, not a production configuration.

For an API process running directly on the host, use the host-facing Redis URL `redis://localhost:6379`. If an API container is later added to the same Compose network, use the Redis service hostname and container port, `redis://redis:6379`; `localhost` inside that API container would refer to the API container itself. There is no API service defined in the current Compose file.

Start the API from `apps/api` with:

```powershell
pnpm start:dev
```

Use `pnpm build` from `apps/api` for the existing Nest build script. Automated tests were deferred and were not run as part of the recent Authentication review; the current test files are not a substitute for integration or concurrency verification.

## Environment variables

`ConfigModule` loads `.env` from the process working directory and validates configuration with Joi at startup. `DATABASE_URL` is validated as present and non-empty; this check by itself does not prove connectivity. The API’s Prisma provider attempts its database connection when the Nest module initializes. Do not place actual secret values in checked-in documentation.

| Variable | Validation and default |
| --- | --- |
| `NODE_ENV` | One of `development`, `production`, or `test`; defaults to `development`. |
| `PORT` | Integer from 1 through 65535; defaults to `3000`. |
| `DATABASE_URL` | Required, trimmed, non-empty string. Supply the local PostgreSQL connection settings through the ignored local environment file; do not copy credentials into documentation. |
| `REDIS_URL` | A `redis://` or `rediss://` URI; defaults to `redis://localhost:6379` for an API process running on the host. |
| `WEB_ORIGIN` | HTTP or HTTPS URI; defaults to `http://localhost:5173`. It is used for both credentialed CORS and the Origin guard’s allowed origin. |
| `JWT_ACCESS_SECRET` | Required string with at least 32 characters. No default is defined. Keep the actual value private. |
| `JWT_ACCESS_TTL_SECONDS` | Integer from 60 through 3600 seconds; defaults to `900` seconds. |
| `SESSION_MAX_AGE_DAYS` | Integer from 1 through 90 days; defaults to `30` days. |
| `REFRESH_TOKEN_TTL_DAYS` | Integer from 1 through 30 days; defaults to `7` days. Refresh tokens do not outlive their owning session. |
| `THROTTLE_TTL` | Integer of at least 1, in milliseconds; defaults to `60000` ms. |
| `THROTTLE_LIMIT` | Integer of at least 1 requests per configured throttling window; defaults to `100`. |

The current Vite configuration uses the default development server port, which matches the default `WEB_ORIGIN`. Set `WEB_ORIGIN` to the origin only (scheme, host, and optional port), without a path. If Vite chooses another port or the frontend is hosted at another origin, update `WEB_ORIGIN` to that exact origin. Browser clients making cross-origin requests must opt into credentials for cookie authentication.

## Redis-backed rate-limit verification

The API creates a shared Redis client from `REDIS_URL` and passes it to `RedisThrottlerStorage`. The global throttler uses `THROTTLE_LIMIT` and `THROTTLE_TTL`; Authentication overrides currently allow 5 requests per 60 seconds for registration and login, and 10 per 60 seconds for refresh. These limits are application configuration, not proof that the values are final product policy.

The following local manual verification was observed for this checkpoint:

1. Redis returned `PONG` to its health/connectivity check.
2. After an API request, Redis contained a key under the `_throttler:` prefix.
3. Two API instances ran locally on ports `3000` and `3001`.
4. Six registration requests from the same client were alternated between the two instances within one minute. The first five reached DTO validation and returned `400`; the sixth returned `429 Too Many Requests`.

This confirms shared rate-limit counter behavior in that local scenario. It does not establish production throughput, Redis failover behavior, persistence, scalability, or production readiness. The local Redis service is loopback-published and intentionally non-persistent; production requires a separately validated shared Redis deployment and operational configuration.
