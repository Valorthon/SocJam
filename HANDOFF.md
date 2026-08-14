# OmniPost Handoff

## Current Status

| Branch | Status |
|---|---|
| `feature/OmniPost-001` | Merged to `develop` |
| `feature/OmniPost-002` | Merged to `develop` |
| `feature/OmniPost-003` | Merged to `develop` |
| `feature/OmniPost-004` | Merged to `develop` |
| `feature/OmniPost-005` | Merged to `develop` |
| `feature/OmniPost-006` | Merged to `develop` |
| `feature/OmniPost-007` | Merged to `develop` |
| `feature/OmniPost-008` | Merged to `develop` |
| `feature/OmniPost-009` | Merged to `develop` |
| `feature/OmniPost-010` | Merged to `develop` |
| `feature/OmniPost-011` | Merged to `develop` |
| `feature/OmniPost-012` | In progress — backend/configuration verification |

---

## OmniPost-001 to OmniPost-004 Summary

- Established the Next.js 14, TypeScript, Tailwind, Prisma, and PostgreSQL project foundation, including local setup, environment documentation, and a Prisma singleton.
- Implemented the complete Prisma domain schema and migration for users, social accounts, posts, targets, media, analytics, and AI generations.
- Added the client-safe platform constraints module as the single source of truth for supported platforms, character limits, and media validation.
- Delivered credentials authentication with Auth.js, Prisma adapter models, registration and login flows, shared auth validation, throttled failed logins, session user IDs, development seed credentials, and shadcn-compatible UI primitives.

---

## OmniPost-005 to OmniPost-008 Summary

- Established shared Zod request/response contracts, authenticated-user resolution, and CI verification for API work.
- Added the mock platform adapter boundary for all five supported platforms, including deterministic publishing, failure simulation through `MOCK_FAILURE_RATE`, auth checks, and analytics fixtures.
- Delivered authenticated mock social-account APIs for connecting, listing, and safely disconnecting user-owned accounts.
- Delivered idempotent post creation, list, and detail APIs with durable draft targets, user scoping, shared DTO mapping, and explicit Day 2 hard-cut validation for media uploads and scheduling.

---

## OmniPost-009 - Idempotent Publish Service and Target Status Handling

### Changes
- Added a server-only publish service that loads a user-owned post with its targets, media, and social accounts before publishing.
- Publishes only `DRAFT` targets through the platform adapter registry, transitioning each target through `PUBLISHING` to `PUBLISHED` or `FAILED`.
- Atomically claims the parent post with `DRAFT` to `PUBLISHING` before loading targets, so a concurrent publish request cannot deliver the same target twice.
- Persists target publish timestamps, URLs, sanitized errors, and attempt counts; previously published targets are idempotent no-ops.
- Checks account availability before publishing and marks accounts `RECONNECT_REQUIRED` when authentication is no longer active or expires during publishing.
- Added one shared parent-status derivation function for `PUBLISHED`, `PARTIALLY_FAILED`, and `FAILED` post outcomes.
- Added publisher smoke coverage for successful and all-failed publishing, inactive accounts, adapter exceptions, attempts, concurrent publish requests, and repeated publish no-op behavior.

### Files
- `src/lib/posts/publisher.ts`
- `tests/publisher.test.ts`
- `package.json`

### Verification
- Publisher smoke tests pass, along with the existing platform, account, and post API smoke suites.
- TypeScript verification and linting for the publisher implementation and tests pass.

---

## OmniPost-010 - Publish-Now API Route and Backend Smoke Tests

### Changes
- Added authenticated `POST /api/posts/[id]/publish`, backed by the OmniPost-009 publishing service.
- Added a dependency-injected publish route handler using the existing post ID schema and authenticated-user boundary.
- Restricts publishing to user-owned posts and returns `404` for missing or foreign posts without disclosing their existence.
- Returns the existing post-detail DTO after publishing and uses sanitized `401`, `400`, and `500` responses for unauthorized, invalid, and unexpected-error paths.
- Added publish API smoke coverage for successful, partially failed, repeated, invalid-ID, missing-post, and unauthenticated requests.

### Files
- `src/app/api/posts/[id]/publish/route.ts`
- `src/lib/posts/route-handlers.ts`
- `tests/publish-api.test.ts`
- `package.json`

### Verification
- Publish API smoke tests pass, together with the publisher and existing platform, account, and post API smoke suites.
- TypeScript verification and linting for the publish route implementation and tests pass.

---

## OmniPost-011 - AI Adaptation and Retry-Failed APIs

### Changes
- Added the server-only `AIProvider` boundary with an OpenAI implementation and deterministic fallback when no API key is configured.
- Added authenticated `POST /api/ai/adapt`, platform-aware prompts sourced from `constraints.ts`, Zod validation, and per-variant validation feedback.
- Added authenticated `POST /api/posts/[id]/retry`, atomically claiming only failed targets so successful delivery is never repeated.
- Added AI and retry route/service smoke coverage, including concurrent retry claim coverage and partial media defaults.
- Documented deterministic mock-failure recovery: reset `MOCK_FAILURE_RATE` to `0` and restart before demonstrating a successful retry.

### Verification
- Full smoke suite, typecheck, lint, and production build passed before merge.

---

## OmniPost-012 - Day 5 Backend Readiness

### Completed now
- Added explicit unauthorized and malformed-request coverage to the account and post API smoke suites.
- Verified the isolated setup sequence requires `pnpm prisma generate` before running tests; README now documents that step and includes `pnpm test` in verification.
- Verified the backend smoke suite on the merged OmniPost-011 baseline.

### Waiting for Developer B
- The full browser acceptance journey cannot run until the Accounts, Composer, and Dashboard implementations merge into `develop`.
- After that merge, jointly verify: sign-in; X, LinkedIn, and Instagram mock connection; AI adaptation and manual edit; publish; forced failure; retry after resetting `MOCK_FAILURE_RATE`; and dashboard refresh with persisted statuses.
- Log and fix only high-severity backend blockers discovered during that joint run; UI-only issues remain with Developer B.
- Docker Compose validation also remains to be run on a machine with Docker installed; the current environment does not provide the `docker` CLI.

---

## Branch State

```
2cdd31f origin/develop [OmniPost-023] - Add auth onboarding flow
```

---

## Quick Commands

```bash
# Setup
pnpm install
docker compose up -d
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed

# Dev server
pnpm dev

# Verification
pnpm test
pnpm typecheck
pnpm lint
pnpm build

# Database
pnpm prisma studio
```

---

## Dev Credentials

| Email | Password |
|---|---|
| `dev@omnipost.local` | `password123` |

---

## Next Steps

1. Merge Developer B's Accounts, Composer, and Dashboard work into `develop`.
2. Run the shared Day 5 browser acceptance journey and address any high-severity backend blocker.
