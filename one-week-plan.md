# OmniPost - One-Week Development Plan

With two developers and one week, this should be a polished, demoable vertical slice - not the complete MVP.

## One-week scope

A user can:

1. Create an account and sign in with email and password.
2. Connect two or more mocked social accounts.
3. Write a base post and select accounts.
4. Generate mocked or Claude-powered per-platform variants.
5. Edit variants and validate character limits.
6. Publish immediately to mocked platforms.
7. See each platform's `Published` or `Failed` status in the dashboard.
8. Retry failed targets without duplicating successful publishes.

## Delivery schedule

| Day | Developer A - backend | Developer B - frontend |
|---|---|---|
| Day 1 | Next.js/Prisma/Auth setup; schema; constraints; seed/config | App shell, auth pages, dashboard and compose page scaffolding |
| Day 2 | Mock account APIs; mock adapters; post create/list/detail APIs | Accounts screen + mock connect dialog; composer basic text/platform selection |
| Day 3 | Idempotent publish service; target status handling; forced-failure environment setting | Variant cards, validation states, publish flow, status badges |
| Day 4 | AI adaptation endpoint; retry-failed endpoint; API integration fixes | AI UX, post history/detail screen, retry controls, mobile pass |
| Day 5 | Integration tests and failure-path fixes; deployment/config readiness | End-to-end QA, loading/error states, visual polish, demo script |

## Hard cuts for this week

- No scheduling, cron, calendar, missed-post behavior, or rescheduling.
- No analytics snapshots or analytics page.
- No real social OAuth or real platform APIs.
- No Google OAuth; credentials only.
- No production-grade media storage. Omit uploads or use a simple local image attachment path for the demo.
- No sophisticated rate limiting, login throttling, DST handling, optimistic concurrency, or retry backoff.
- AI daily quota may be a simple configuration check or deferred.
- Build only the "Customize per platform" composer mode initially. Add "Same for all" only if the core flow is complete by Day 4 morning.

## End-of-week acceptance test

1. Register and sign in.
2. Connect X, LinkedIn, and Instagram mock accounts.
3. Draft text, generate variants, and edit one variant.
4. Publish to all three.
5. Simulate one platform failure via `MOCK_FAILURE_RATE`.
6. Confirm successful platforms are not re-published when retrying the failed one.
7. Refresh the dashboard and see durable per-platform results.

## Implementation focus

Build the post-target state machine once - `DRAFT -> PUBLISHING -> PUBLISHED/FAILED` - and have every screen reflect it. This produces a credible base for scheduling and analytics in the next iteration.

## Daily objectives by developer

### Day 1

**Developer A - backend**

- Initialize the Next.js application, Prisma connection, and environment-variable template.
- Implement the core Prisma models and migrations for users, social accounts, posts, and post targets.
- Create the shared platform constraints module for character limits and basic platform requirements.
- Configure credentials-based authentication and provide seed data or a simple development setup path.

**Developer B - frontend**

- Establish the mobile-first application shell: navigation, page layout, and shared UI primitives.
- Build the sign-up and login screens and connect them to the authentication flow.
- Create initial dashboard and compose-page layouts using loading/empty states.
- Agree with Developer A on typed API payloads before wiring feature components.

### Day 2

**Developer A - backend**

- Implement mock account connection, listing, and disconnection endpoints.
- Create the five mock platform adapters and the adapter registry.
- Implement post creation, post listing, and post-detail APIs with server-side validation.
- Ensure each new post receives an idempotency key and durable post-target records.

**Developer B - frontend**

- Build the Accounts page with connected/disconnected platform cards.
- Implement the mock consent dialog and account-connect flow.
- Build the base composer: text field, account/platform selector, and initial validation messages.
- Display selected platforms and initialize editable post variants from the base draft.

### Day 3

**Developer A - backend**

- Implement the publishing service and post-target transitions from draft to publishing to published or failed.
- Add idempotent publish handling so a repeated request cannot create duplicate platform posts.
- Support configurable mock failures through `MOCK_FAILURE_RATE`.
- Return sanitized per-target publish results and derive the parent post status.

**Developer B - frontend**

- Build per-platform variant cards with character counts and inline validation errors.
- Add publish controls, in-flight disabled states, and server-result handling.
- Implement reusable status badges for publishing, published, and failed states.
- Begin rendering post-target status in the dashboard and post-detail experience.

### Day 4

**Developer A - backend**

- Implement the AI provider boundary and the adaptation endpoint, using Claude when configured or a safe mocked response otherwise.
- Validate AI outputs against platform constraints before returning them to the client.
- Implement the retry endpoint so it targets only failed post targets.
- Resolve integration defects found while connecting frontend flows to live endpoints.

**Developer B - frontend**

- Add the AI adaptation button, generation state, and generated-variant replacement flow.
- Build the post history and post-detail screens with per-platform result rows.
- Add retry controls for failed targets and clear error feedback.
- Verify the composer and publish flow remain usable at a 375px viewport width.

### Day 5

**Developer A - backend**

- Run integration tests for authentication, account connection, post creation, publishing, duplicate submission, failure, and retry.
- Verify environment configuration and document the minimal setup required to run the demo.
- Fix high-severity issues discovered during joint end-to-end testing.

**Developer B - frontend**

- Execute end-to-end QA across the primary demo journey and failure journey.
- Complete loading, empty, validation, and error states needed for a coherent demo.
- Polish responsive layout and prepare a concise demonstration script.
- Pair with Developer A to validate the final acceptance test before handoff.
