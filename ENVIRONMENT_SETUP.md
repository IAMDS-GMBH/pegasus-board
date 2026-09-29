# Local development setup

Use Node.js 24.11 or newer in the 24.x line, or Node.js 26+, and pnpm 10.32.1, as declared in the root `package.json`. You also need a local PostgreSQL database. Redis and object storage are optional.

## Configure the API

Create `.env` in the repository root. If you copy `.env.sample`, replace its empty secrets and choose a database address that the API can reach.

```env
KANEO_CLIENT_URL=http://localhost:5173
KANEO_API_URL=http://localhost:1337
DATABASE_URL=postgresql://kaneo:YOUR_LOCAL_PASSWORD@localhost:5432/kaneo
AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET
```

Generate the authentication secret with `openssl rand -hex 32`. Keep it stable between runs. It protects authentication.

Create the database and user before starting the API. The API applies committed migrations at startup. Use a development database, never a production database.

An explicit `DATABASE_URL` takes precedence over `POSTGRES_*`. You do not need both. If you choose derived configuration, set `POSTGRES_PASSWORD` and `POSTGRES_HOST=localhost` for a host-native API. The default hostname `postgres` is for containers sharing a Compose network. `POSTGRES_DB` and `POSTGRES_USER` alone do not enable derivation.

The bundled Docker image derives `KANEO_API_URL` from `KANEO_CLIENT_URL`. Host-native development does not run that entrypoint, so set the two URLs explicitly as above.

## Configure the browser

The API reads the root `.env`. Vite reads frontend overrides from `apps/web/.env.local`.

The default development API address is `http://localhost:1337`. To change it, create:

```env
# apps/web/.env.local
VITE_API_URL=http://localhost:1337
```

Only put public browser configuration in `VITE_*` variables. Never put database passwords, API keys, or provider secrets there. Restart Vite after changing the file.

The production containers use different names: their startup script replaces `KANEO_API_URL`, `KANEO_CLIENT_URL`, and `KANEO_TURNSTILE_SITE_KEY` in the built assets. Editing `VITE_API_URL` in a running container does not change its API address.

## Install and start

From the repository root:

```bash
pnpm install
pnpm dev
```
# Environment Setup Guide

This guide will help you set up the Kaneo development environment and troubleshoot common issues.

## Quick Start

1. **Create a `.env` file** in the root of the project with the required environment variables (see the [documentation](https://kaneo.app/docs/core/installation/environment-variables) for the complete list).

2. **Start PostgreSQL and MinIO** (optional, see [Backing services with Docker](#backing-services-with-docker)):
   ```bash
   docker compose -f compose.dev.yml up -d
   ```

3. **Start the development servers**:
   ```bash
   pnpm dev
   ```

This starts both the API (port 1337) and web app (port 5173). Both will automatically reload when you make changes.

> **Tip**: The web app at http://localhost:5173 will automatically connect to the API at http://localhost:1337

## Backing services with Docker

`compose.dev.yml` runs only the services the API depends on, so the API and web app keep running on your host with `pnpm dev`:

| Service | Address | Purpose |
|---------|---------|---------|
| `postgres` | `127.0.0.1:5432` | PostgreSQL 16 database |
| `minio` | `127.0.0.1:9000` (S3 API), `127.0.0.1:9001` (console) | S3-compatible storage for uploads |
| `minio-init` | — | Creates the `S3_BUCKET` bucket, then exits |

All ports are bound to loopback. MinIO is optional: skip it with `docker compose -f compose.dev.yml up -d postgres` if you don't need uploads.

Add these values to your root `.env`. Compose refuses to start if a password or the MinIO root user is missing.

```env
POSTGRES_DB=kaneo
POSTGRES_USER=kaneo
POSTGRES_PASSWORD=<choose-a-local-development-password>
DATABASE_URL=postgresql://kaneo:<same-password>@localhost:5432/kaneo

MINIO_ROOT_USER=kaneo-local
MINIO_ROOT_PASSWORD=<choose-a-local-development-password>

S3_ENDPOINT=http://localhost:9000
S3_BUCKET=kaneo-uploads
S3_ACCESS_KEY_ID=kaneo-local
S3_SECRET_ACCESS_KEY=<same-as-MINIO_ROOT_PASSWORD>
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Use `localhost`, not `postgres` or `minio`, because the API runs on your host. The browser uploads straight to MinIO through presigned URLs, so `S3_ENDPOINT` must also be reachable from the browser. MinIO allows cross-origin requests from `KANEO_CLIENT_URL`.

Stop the services with `docker compose -f compose.dev.yml down`. Add `-v` to also delete the database and uploaded files.

> **MinIO image availability:** MinIO no longer publishes public container images, so a fresh pull of the pinned image can fail with `unauthorized`. If that happens, set `MINIO_IMAGE` in `.env` to a MinIO image you can pull (a registry mirror or your own build), or leave MinIO out and use another S3-compatible backend. The same image also runs the bucket setup, so it must include `mc` and `/bin/sh`.

## Environment Variables

Kaneo uses a **single `.env` file** in the root of the project for all environment variables. This file is shared by both the API and web services.

### Required Variables

For development, you'll need at minimum:

- `KANEO_CLIENT_URL` - The URL of the web application (e.g., `http://localhost:5173`)
- `KANEO_API_URL` - The URL of the API (e.g., `http://localhost:1337`)
- `AUTH_SECRET` - **Required.** Secret key for JWT token generation (**must be at least 32 characters long**; use a long, random value in production). The API refuses to start without it, because an unset secret would fall back to a publicly known default and make every session cookie forgeable. The Docker entrypoint generates a random one per session if you do not set it, so sessions will not survive a restart until you do. Generate one with `openssl rand -hex 32`.
- `DEVICE_AUTH_CLIENT_IDS` - **Optional.** Comma-separated list of allowed device-flow OAuth client IDs. When unset, Kaneo implicitly allows `kaneo-cli` and `kaneo-mcp` by default (no extra configuration for the CLI or MCP). Override only when you need additional trusted clients, for example `kaneo-cli,kaneo-mcp,my-desktop-app`.
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_DB` - PostgreSQL database name
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password

If your app uses a device client ID that is not included in the defaults, set `DEVICE_AUTH_CLIENT_IDS` to the full comma-separated list of allowed IDs (including any defaults you still need), so it includes the client ID your app sends to `/api/auth/device/code`.

### Development-Specific Variables

For local development, the web app also supports:
- `VITE_API_URL` - API URL for development (defaults to `http://localhost:1337` if not set)
- `VITE_APP_URL` - App URL for generating links (optional)

### Optional Variables

Kaneo supports many optional configuration options including:
- `KANEO_INTERNAL_API_URL` - API origin used only for server-side requests from the built-in HTTP MCP endpoint. Defaults to `http://127.0.0.1:1337`; override it only if the API is not reachable there from its own process.
- SSO providers (GitHub OAuth via `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`, Google, Discord, Custom OAuth/OIDC)
- GitHub repository integration (GitHub App: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, optional `GITHUB_APP_NAME`), separate from GitHub SSO
- SMTP configuration for email
- Access control settings
- CORS configuration
- Redis for horizontal scaling
- Private-network notification receivers (`KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS=true` lets ntfy/Gotify/webhook destinations resolve to private addresses; off by default to prevent SSRF)

#### Redis Configuration

Kaneo supports three Redis deployment modes for WebSocket Pub/Sub. When any Redis mode is configured, WebSocket broadcasts use Redis Pub/Sub, allowing multiple API instances to relay real-time updates. When none are set, an in-memory adapter is used (single-instance only).

**Standalone (single server):**
- `REDIS_URL` - Redis connection string (e.g., `redis://localhost:6379`)

**Sentinel (high-availability with automatic failover):**
- `REDIS_SENTINELS` - Comma-separated list of Sentinel nodes (e.g., `sentinel-1:26379,sentinel-2:26379,sentinel-3:26379`)
- `REDIS_SENTINEL_MASTER_NAME` - Name of the Sentinel master group (default: `mymaster`)
- `REDIS_SENTINEL_PASSWORD` - Password for Sentinel instances, if different from the Redis password (optional)
- `REDIS_SENTINEL_TLS` - Set to `true` to enable TLS for Sentinel connections (default: `false`)

**Cluster (horizontal sharding):**
- `REDIS_CLUSTER_NODES` - Comma-separated list of cluster seed nodes (e.g., `node-1:6379,node-2:6379,node-3:6379`)

**Shared (used by Sentinel and Cluster modes):**
- `REDIS_PASSWORD` - Password for the Redis data nodes (used by both Sentinel and Cluster modes, not for Sentinel auth itself; use `REDIS_SENTINEL_PASSWORD` for that)

> **Note:** Only one mode should be configured at a time. If multiple are set, the priority is: Cluster > Sentinel > Standalone.

#### SMTP Configuration

For sending emails (workspace invitations, magic links, etc.), configure these variables:
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `SMTP_FROM` - From email address
- `SMTP_SECURE` - Use TLS immediately (default: `true`, typically port 465). Set to `false` for STARTTLS, typically on port 587.
- `SMTP_REQUIRE_TLS` - Require a STARTTLS upgrade when `SMTP_SECURE=false` (default: `true`). Sending fails if the server cannot upgrade. Only set to `false` for an intentionally unencrypted local development relay.
- `SMTP_IGNORE_TLS` - Removed: `true` is rejected because this option disabled STARTTLS and could send credentials and emails in plaintext.

For a private SMTP certificate authority, configure Node's `NODE_EXTRA_CA_CERTS` with the path to a trusted CA PEM file before starting the API. Fix expired certificates or hostname mismatches instead of bypassing validation. When upgrading an existing installation, remove `SMTP_IGNORE_TLS=true` and check SMTP delivery with the corrected trust configuration before rollout.

When SMTP is configured, sign-in uses email verification codes by default. Set `DISABLE_EMAIL_OTP_SIGN_IN=true` to use email/password sign-in instead (workspace invitation emails still use SMTP).

#### Cloud-mode abuse mitigations

Hosted multi-tenant instances should enable the cloud abuse gates. Self-hosted instances can leave these unset.

- `KANEO_CLOUD` - Set to `true` to enable cloud-only protections: disposable-email signup block, Turnstile captcha enforcement, guest-account invite block, and tightened rate limits on `/sign-up/email` and `/organization/invite-member`.
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key (API container, server-side verification). When unset, captcha verification is skipped.
- `KANEO_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key, on the **web container**. The production web image bakes the literal placeholder `KANEO_TURNSTILE_SITE_KEY` into the bundle; `apps/web/env.sh` swaps it for the runtime value when the container starts.
- `VITE_TURNSTILE_SITE_KEY` - Local dev only. Set in `apps/web/.env` when running `pnpm dev`; Vite reads this at build/dev time. Not used in the production image.

#### Sentry (error monitoring)

All Sentry integration is opt-in; leave these unset for zero telemetry.

- `SENTRY_DSN` - Sentry DSN for the API. When unset, the Sentry SDK never initializes.
- `SENTRY_ENVIRONMENT` - Environment tag for API events (defaults to `NODE_ENV`).
- `SENTRY_TRACES_SAMPLE_RATE` - Fraction of API requests to trace for performance monitoring, `0`-`1` (default: `0`, tracing off).
- `KANEO_SENTRY_DSN` - Sentry DSN for the **web container** (browser errors, tracing, session replay). Same runtime-placeholder mechanism as `KANEO_TURNSTILE_SITE_KEY`.
- `VITE_SENTRY_DSN` - Local dev only. Set in `apps/web/.env` when running `pnpm dev`.

For a complete list of all environment variables, their descriptions, and configuration options, see the [official documentation](https://kaneo.app/docs/core/installation/environment-variables).

## Common Issues & Troubleshooting

### CORS Errors

**Symptoms:**
- "Failed to fetch" errors in browser console
- Network errors when making API requests
- "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Solutions:**

1. **Check URL Configuration:**
   - Ensure `KANEO_API_URL` matches your API server URL
   - Ensure `KANEO_CLIENT_URL` matches your web app URL
   - For development, you can also set `VITE_API_URL` in your `.env` file

2. **Configure CORS Origins:**
   - Add your frontend URL to `CORS_ORIGINS` in your `.env`:
     ```
     CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
     ```
   - In development, unconfigured HTTP CORS may reflect origins. WebSocket connections always require an allowed origin (`KANEO_CLIENT_URL`, `KANEO_API_URL`, or an explicit `CORS_ORIGINS` entry).
   - **Note:** `CORS_ORIGINS` should match `KANEO_CLIENT_URL` for proper authentication

3. **Check Protocol Consistency:**
   - Ensure both frontend and API use the same protocol (http/https)
   - Don't mix http and https in development

4. **Verify Server Accessibility:**
   - Test if the API is accessible: `curl http://localhost:1337/config`
   - Check if the server is running on the correct port

### Database Connection Issues

**Symptoms:**
- "Database connection failed" errors
- API server won't start

**Solutions:**

1. **Check PostgreSQL:**
   - Ensure PostgreSQL is running
   - Verify database exists and credentials are correct
   - Test connection: `psql $DATABASE_URL`

2. **Update DATABASE_URL:**
   - Ensure the connection string format is correct
   - Check username, password, host, port, and database name

3. **Match the hostname to where the API runs:**
   - Use `postgres` only when the API container is on the same Docker Compose network as the Postgres service
   - Use `localhost` when the API runs directly on your host machine
   - If you see `getaddrinfo EAI_AGAIN postgres`, the API is trying to resolve the Compose hostname from the wrong network context

4. **Use the right configuration mode:**
   - For host-native development, prefer an explicit `DATABASE_URL`
   - If you derive from `POSTGRES_*`, set `POSTGRES_HOST=localhost` when running the API on your host
   - `POSTGRES_DB` and `POSTGRES_USER` by themselves do not switch Kaneo into derived connection mode

### Authentication Issues

**Symptoms:**
- "Authentication failed" errors
- Users can't sign in

**Solutions:**

1. **Check Authentication Configuration:**
   - Ensure `AUTH_SECRET` is set in your `.env` file
   - Use a strong secret in production
   - Verify `KANEO_CLIENT_URL` and `KANEO_API_URL` are correctly configured

2. **Clear Browser Data:**
   - Clear cookies and local storage
   - Try in incognito/private mode

### Network Errors

**Symptoms:**
- "Network error" messages
- API requests timeout

**Solutions:**

1. **Check Server Status:**
   - Verify API server is running
   - Check server logs for errors

2. **Check Firewall/Proxy:**
   - Ensure ports are not blocked
   - Check if proxy settings interfere

3. **Verify URLs:**
   - Check that all URLs are accessible
   - Test with curl or browser

## Development vs Production

### Development
- Use `http://localhost` for both frontend and API
- Set `KANEO_CLIENT_URL` and `KANEO_API_URL` to your local URLs; list any additional frontend origins in `CORS_ORIGINS`. WebSocket origins are checked even in development (defaults are `http://localhost:5173` and `http://localhost:1337` when the corresponding URL is unset).
- Use simple secrets for `AUTH_SECRET` (not for production)
- The web app will use `VITE_API_URL` if set, otherwise defaults to `http://localhost:1337`

### Production
- Use HTTPS for both frontend and API
- Set specific `CORS_ORIGINS` for security (should match `KANEO_CLIENT_URL`)
- Use strong, unique secrets for `AUTH_SECRET`
- Configure proper database credentials
- Ensure `KANEO_CLIENT_URL` and `KANEO_API_URL` are set to your production URLs

## Getting Help

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Review the API server logs
3. Verify all environment variables are set correctly
4. Ensure all services (PostgreSQL, API, Frontend) are running
5. Consult the [official documentation](https://kaneo.app/docs) for detailed guides and troubleshooting

For the most up-to-date information on environment variables and configuration, always refer to the [official documentation](https://kaneo.app/docs/core/installation/environment-variables).
Open http://localhost:5173. Check API readiness separately:

```bash
curl --fail http://localhost:1337/api/health
```

The first non-guest account completes instance setup. Keep this local instance private until you have created it.

## Optional features

Use the [environment reference](https://kaneo.app/docs/core/installation/environment-variables) for server settings and defaults.

- **Uploads:** configure S3-compatible storage. [Silo](https://kaneo.app/docs/core/installation/silo) is the documented self-hosted option. The API and browser must both reach its endpoint.
- **Email:** configure SMTP. Email verification codes become the default sign-in method; `DISABLE_EMAIL_OTP_SIGN_IN=true` keeps password sign-in. Invitations and password resets still use SMTP.
- **Sign-in providers:** configure OAuth credentials on the API and register the local callback URL with the provider.
- **MCP:** the built-in endpoint uses `KANEO_INTERNAL_API_URL`, defaulting to `http://127.0.0.1:1337`, for internal tool requests. Device authorization allows `kaneo-cli` and `kaneo-mcp` by default.
- **Private-network connections:** `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS=true` permits internal ntfy, Gotify, webhook, Gitea, and GitLab destinations. Only enable it on a trusted deployment.
- **Redis:** only needed to relay live updates between multiple API instances. Leave it unset for one local API process.
- **CAPTCHA:** set `TURNSTILE_SECRET_KEY` in the root `.env` and the matching `VITE_TURNSTILE_SITE_KEY` in `apps/web/.env.local`. The secret enables verification independently of cloud mode. Configure a widget that accepts your development hostname.
- **Sentry:** `SENTRY_DSN` enables API reporting. A browser build reads `VITE_SENTRY_DSN`; the current container renderer does not substitute `KANEO_SENTRY_DSN` at runtime. Leave reporting unset if you do not need it.

After initial setup, when `DISABLE_REGISTRATION=true`, sign-in emails (OTP codes and magic links) are only sent to addresses that already have an account or hold a pending workspace invitation; unknown addresses get a generic success response with no email. When `DISABLE_PASSWORD_REGISTRATION=true`, only existing accounts receive them. An empty instance with `DISABLE_REGISTRATION=true` still accepts sign-in emails for any address until the first non-guest account is created.

Sign-in email eligibility checks and delivery run in the API process after the request is accepted, so the response does not wait for SMTP. Pending sends are given up to 10 seconds to finish during graceful shutdown; they are not persisted across a process crash.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API cannot resolve `postgres` | Use `localhost` in the database URL when the API runs on your host. |
| Database authentication fails | Confirm the database exists and the URL matches its actual user and password. |
| Browser requests reach the wrong API | Check `apps/web/.env.local`, then restart Vite. |
| CORS or WebSocket origin error | Set `KANEO_CLIENT_URL` to the exact browser origin. Put additional allowed origins in the comma-separated `CORS_ORIGINS` value. |
| OAuth returns to the wrong address | Check `KANEO_API_URL` and the provider callback URL. |
| Sign-in breaks after restarting | Keep `AUTH_SECRET` unchanged and ensure every API process uses the same value. |
| Upload URL cannot be reached | Use an endpoint the browser can resolve, not a Docker-only storage hostname. |

For deployed instances, use the [self-hosting guide](https://kaneo.app/docs/core/installation) and [operations troubleshooting](https://kaneo.app/docs/core/operations/troubleshooting).
