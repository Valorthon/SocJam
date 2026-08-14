# AGENTS.md — Guidelines for AI Coding Agents

## Read this first

**`SPEC.md` contains the overview and specifications of this project** — product goal, target users, tech stack, file structure, feature requirements, edge case
s ("unhappy paths"), the Prisma data model, and the platform adapter interface. Read it before doing anything non-trivial.

- Product/behavior questions → SPEC.md is the source of truth.
- Workflow/process questions → this file is the source of truth.
- If both are silent on a decision → **ask before inventing**. Do not introduce new dependencies, platforms, architectural patterns, or unrequested features on
your own initiative.

## Tech stack (locked)

Do NOT deviate from these tools or add new dependencies without explicit approval.

- **Package manager:** pnpm — always. Never use npm or yarn; the lockfile is `pnpm-lock.yaml`. Install with `pnpm add <pkg>` (and ask before adding anything).
- **Framework:** Next.js 14 (App Router) + TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query for server state; Zustand for composer UI state only
- **DB / ORM:** PostgreSQL + Prisma
- **Auth:** Auth.js (NextAuth v5) — credentials (argon2) + Google OAuth
- **AI:** OpenAI API (GPT models) behind the `AIProvider` interface (`lib/ai/`). Model is configurable via the `AI_MODEL` env var. Other OpenAI tools/models — o
r another provider entirely — must be addable by implementing the same interface; feature code never calls the OpenAI SDK directly.
- **Platforms:** mock adapters behind the `SocialPlatformAdapter` interface (`lib/platforms/`)

## Hard rules (never violate)

1. **TypeScript strict.** No `any` without an `// eslint-disable` justification comment.
2. **Functional components + hooks only.** No class components. Server Components by default; add `"use client"` only when interactivity requires it.
3. **Mobile-first responsive.** Everything, especially the composer, must work at 375px width.
4. **Prisma lives in server code only** (route handlers / server actions). Never import `lib/db` into a client component.
5. **Zod-validate at every boundary:** every API route input, every AI response, every adapter response.
6. **All platform interaction goes through the adapter registry** (`lib/platforms/registry.ts`). Feature code never calls a platform URL, SDK, or token directly
. Swapping a mock adapter for a real one must require zero change
7. **Per-platform rules live only in `lib/platforms/constraints.ta requirements, file sizes. It is the single source of truth for b
oth client and server validation. Never hardcode a platform rule anywhere else.
8. **Idempotency is non-negotiable:**
   - The client generates a uuid `idempotencyKey` when the composer mounts; a repeated key returns the existing post, never a duplicate.
   - The `SCHEDULED → PUBLISHING` status transition is atomic; twnever publish the same target twice.
   - Retry re-attempts **only** `FAILED` targets — never re-publi
9. **Dates:** stored UTC, rendered in the user's timezone.
10. **Errors shown to users are always sanitized.** Never render aces in the UI.
11. **AI output is never auto-published and never silently truncas and presses Publish/Schedule.

## Architecture invariants (do not break)

- **Post-target state machine:** `DRAFT → PUBLISHING → PUBLISHED CANCELLED / MISSED` reserved for later phases). Every screen refle
cts server-persisted status — no optimistic "published" states.
- **`Post.status` is derived from its targets** (`PUBLISHED` / `PARTIALLY_FAILED` / `FAILED`) by one shared server-side function. Never compute it ad-hoc per sc
reen.
- **Mock adapters** simulate ~600ms latency, return deterministic id, and honor `MOCK_FAILURE_RATE` for failure simulation. Keep th
ese behaviors — the demo and the tests depend on them.
- **AI provider boundary:** all AI calls go through `lib/ai/provice), with a deterministic mock fallback when no API key is configu
red. Prompts live in `lib/ai/prompts/`; each platform variant is generated against that platform's constraints from `constraints.ts`, and outputs are zod-valida
ted before reaching the client.

## File structure

Follow SPEC.md §3 exactly. Summary of the conventions agents get

- Feature components → `src/components/features/<area>/`; only generic primitives in `src/components/ui/`
- Shared zod schemas → `src/lib/validations/` (imported by both c
- Platform logic (interface, constraints, registry, adapters) → `
- AI provider + prompts → `src/lib/ai/`
- Composer UI state → `src/stores/composerStore.ts`; do not put server data in Zustand

## Commands

```bash
pnpm dev             # local dev
pnpm build           # production build
pnpm lint            # eslint
pnpm tsc --noEmit    # typecheck
pnpm test            # tests
pnpm prisma migrate dev   # apply/create migrations
pnpm prisma studio        # inspect data
```

Environment variables are documented in SPEC.md §8. Copy `.env.example`, never commit secrets.

## Current scope

Build only what the current phase plan describes. Scheduling, calendar, analytics, and real OAuth are **future phases** — the schema already reserves room for t
hem (full `TargetStatus` enum, `scheduledAt`, `AnalyticsSnapshot`), but do not implement the features until explicitly asked. Prefer the smallest change that sa
tisfies the current acceptance test.

## Definition of done

A task is complete only when:

1. `pnpm lint` and `pnpm tsc --noEmit` pass.
2. The happy path works **and** the relevant unhappy paths from S
3. Every screen touched has loading, empty, and error states.
4. It works at 375px width.
5. Changes to publish/idempotency/retry logic come with tests covpartial failure, and retry-only-failed.
6. No new dependencies, no schema drift from SPEC.md §6 without a

## Style

Match the surrounding code: naming, file layout, comment density. Small typed helpers over inline logic. If you find yourself copying a validation rule or statu
s mapping to a second place, move it to the shared module instead
