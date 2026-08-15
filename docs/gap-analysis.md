# OmniPost Gap Analysis

> Generated: 2026-08-14
> Reference: `SPEC.md` (OmniPost — Centralized Social Media Control Hub)
> Scope: compare current codebase against SPEC.md and identify missing or incomplete features.

## TL;DR

The **publish-now MVP** is largely complete and tested: credentials auth, mock account connection, composer with AI adaptation, idempotent publish, retry-failed, and dashboard history all work.

The major gaps cluster around **Scheduling/Calendar**, **Analytics**, **Google OAuth**, **Post Detail**, and a handful of **edge-case behaviors** mandated by SPEC §5 (exponential backoff, "Shorten with AI", per-platform upload validation).

---

## Build / Test Health

| Check | Status |
|---|---|
| `pnpm test` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` (`tsc --noEmit`) | PASS |

---

## 1. Auth

| Feature | Status | Notes |
|---|---|---|
| Credentials sign-up / log-in / log-out | Implemented | `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/lib/auth.ts` |
| Zod validation (email, ≥8 char password) | Implemented | `src/lib/validations/auth.ts` |
| Argon2 password hashing | Implemented | `src/app/(auth)/signup/actions.ts` |
| Failed-login throttle (>5 in 15 min) | Implemented | `src/lib/auth.ts` |
| "Forgot password?" stub | Implemented | Renders a "Coming soon" modal |
| **Google OAuth sign-in** | **MISSING / STUBBED** | Button exists but only opens a "Coming soon" modal. `src/lib/auth.ts` has only `CredentialsProvider`; `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are unused. SPEC §4 requires Google OAuth to create a `User` on first login. |
| New-user landing | Partial / deviated | Spec says `/settings/accounts`; app redirects to `/onboarding` (functionally equivalent). |

---

## 2. Accounts / Social Connections

| Feature | Status | Notes |
|---|---|---|
| `/settings/accounts` page | Implemented | |
| Platform cards, connect button, status pill | Implemented | `src/components/features/accounts/AccountCard.tsx` |
| Mock consent dialog | Implemented | `MockConsentDialog.tsx` |
| Duplicate connect guard | Implemented | 409 from account route handler |
| Disconnect with scheduled-target cancellation | Implemented, but schema deviates | Handler cancels `SCHEDULED` targets and recomputes post status. However, `PostTarget.accountId` is nullable `SetNull` in the schema, whereas SPEC §6 shows it as non-nullable. Targets survive account deletion unlinked instead of being tied to the deleted account. |
| Real OAuth | Out of scope | Expected to remain mock for MVP. |

---

## 3. Composer

| Feature | Status | Notes |
|---|---|---|
| Base textarea + live char count | Implemented | `BaseTextArea.tsx` |
| `MediaUploader` multi-file, thumbnails, remove | Implemented | |
| `PlatformSelector` with disabled reconnect accounts | Implemented | |
| `PlatformVariantCard` with char counter + validation | Implemented | |
| Base-draft propagation to unedited variants | Implemented | `composerStore.ts` |
| Validation against `constraints.ts` | Implemented | |
| Publish-now button + disabled states | Implemented | `PublishFooter.tsx` |
| **Schedule button / `SchedulePicker`** | **MISSING / STUBBED** | Disabled with tooltip "Scheduling is coming soon". No `SchedulePicker.tsx` exists. |
| **Per-platform upload-time validation** | **Partially missing** | `MediaUploader.tsx` only validates generic 25MB / image-or-video. It does not reject uploads that violate currently selected platforms (e.g. >4 images for X, no video for TikTok, platform size limits). SPEC §3/§5 requires a toast naming the failing platform and rule. |
| Draft auto-save + resume | Implemented | Draft route handlers + `ContinueEditingModal.tsx` |

---

## 4. AI Adaptation

| Feature | Status | Notes |
|---|---|---|
| `POST /api/ai/adapt` | Implemented | |
| AI provider interface + OpenAI impl | Implemented | `provider.ts`, `openai.ts` |
| Deterministic mock fallback (no API key) | Implemented | |
| Prompt template with constraints | Implemented | `prompts/adaptPost.ts` |
| Tone selector | Implemented | |
| Quota (20/day default) | Implemented | |
| Regenerate confirmation for edited variants | Implemented | `AiAdaptPanel.tsx` |
| Shared-caption generation | Implemented | |
| **"Shorten with AI" quick action** | **MISSING** | SPEC §4 requires a quick-action when AI output violates a platform constraint. `PlatformVariantCard.tsx` only lists errors. |
| **Per-card fallback on AI failure** | **Partial** | Failure shows a global error + Retry button, but SPEC §4 wants each affected card to show "AI failed — using your draft" with base text. |
| AI output safety filter | Extra | `src/lib/ai/safety.ts` (not in SPEC). |
| Groq provider | Extra | `src/lib/ai/groq.ts`, `src/lib/ai/registry.ts` (not prohibited, but SPEC only names OpenAI). |

---

## 5. Publishing / Posts

| Feature | Status | Notes |
|---|---|---|
| `POST /api/posts` idempotent creation | Implemented | |
| Publish-now route | Implemented | |
| Per-target status tracking | Implemented | |
| Derived `Post.status` from targets | Implemented | `src/lib/posts/status.ts` |
| Retry-failed route (only `FAILED` → `PUBLISHING`) | Implemented | |
| Account `RECONNECT_REQUIRED` on auth failure | Implemented | |
| **Publisher exponential backoff (3 retries: 1s, 4s, 16s)** | **MISSING** | SPEC §5.12 requires up to 3 retries; current publisher/retry make a single adapter call. |
| **Post detail page / `PostTargetRow` UI** | **MISSING** | No post detail page. `PostTargetRow.tsx` component does not exist. |
| **Edit / reschedule / cancel post** | **MISSING** | `PATCH` edit/reschedule and `DELETE` are not implemented on `/api/posts/[id]`. Concurrent-edit `409` guard also missing. |
| **"Publish now" action for `MISSED` posts** | **MISSING** | SPEC §5.9 wants one-click publish for `MISSED` posts. |
| **All-targets-cancelled note** | **MISSING** | SPEC §5.8 says a post whose targets are all cancelled becomes `FAILED` *with note "All targets cancelled"*. Status derivation returns `FAILED`, but no note is surfaced. |
| Sanitized errors in UI | Implemented | `safePublishError` in publisher. |

---

## 6. Scheduling / Content Calendar

| Feature | Status | Notes |
|---|---|---|
| `/calendar` page | **STUB** | Placeholder "Scheduling is coming soon". |
| `SchedulePicker` component | **MISSING** | |
| Calendar components (`CalendarView`, `CalendarDayCell`, `ScheduledPostChip`) | **MISSING** | `src/components/features/calendar/` does not exist. |
| `cron/publish-due` route | **MISSING** | `CRON_SECRET` is unused. |
| Cron publisher with `FOR UPDATE SKIP LOCKED` | **MISSING** | `src/lib/posts/publisher.ts` only handles `DRAFT` publish. |
| Schedule validation (past time blocked) | **MISSING** | `scheduledAt` is rejected at creation. |
| Timezone-aware picker / UTC storage | **MISSING** | User timezone is loaded but unused for scheduling. |
| Overdue catch-up / `MISSED` logic | **MISSING** | |
| Server-side re-validation at publish time | **MISSING** | Cron path would need this. |

---

## 7. Analytics

| Feature | Status | Notes |
|---|---|---|
| `/analytics` page shell | Present but static demo | Renders hard-coded `DEMO_METRICS`. |
| `MetricsCard`, `PostMetricsTable`, `TrendBadge` | Demo-only | Accept demo-shaped props, not real `AnalyticsSnapshot` data. |
| `GET /api/analytics` | **MISSING** | |
| `POST /api/analytics` refresh snapshots | **MISSING** | |
| Deterministic mock analytics in adapters | Implemented | `baseMock.ts` |
| "Refresh metrics" rate-limit (5 min) | **MISSING** | Button disabled with fake countdown. |
| Stale-data badge on fetch failure | UI exists but unused | |

---

## 8. Uploads / Media Storage

| Feature | Status | Notes |
|---|---|---|
| `MediaStorage` interface + local disk impl | Implemented | |
| `POST /api/uploads` | Implemented (single file per request) | |
| GET media file route | Implemented | |
| 25 MB hard cap + type rejection | Implemented | |
| Multi-file upload client support | Implemented | |
| S3-compatible storage | Out of scope | |

---

## 9. API Routes vs. SPEC §3

| Route | Status |
|---|---|
| `/api/auth/[...nextauth]/route.ts` | Implemented |
| `/api/accounts/route.ts` (GET/POST) | Implemented |
| `/api/accounts/[id]/route.ts` (DELETE) | Implemented |
| `/api/posts/route.ts` (GET/POST) | Implemented; `POST` rejects `scheduledAt` |
| `/api/posts/[id]/route.ts` | **Partial** — only `GET`; missing `PATCH` and `DELETE` |
| `/api/posts/[id]/publish/route.ts` | Implemented |
| `/api/posts/[id]/retry/route.ts` | Implemented |
| `/api/ai/adapt/route.ts` | Implemented |
| `/api/analytics/route.ts` | **MISSING** |
| `/api/cron/publish-due/route.ts` | **MISSING** |
| `/api/uploads/route.ts` | Implemented |
| `/api/posts/drafts/route.ts` | Extra (auto-save), not in SPEC §3 |

---

## 10. Components vs. SPEC §3

| Component | Status |
|---|---|
| `components/features/composer/Composer.tsx` | Implemented |
| `components/features/composer/PlatformSelector.tsx` | Implemented |
| `components/features/composer/PlatformVariantCard.tsx` | Implemented |
| `components/features/composer/AiAdaptPanel.tsx` | Implemented |
| `components/features/composer/MediaUploader.tsx` | Implemented |
| `components/features/composer/SchedulePicker.tsx` | **MISSING** |
| `components/features/accounts/AccountCard.tsx` | Implemented |
| `components/features/accounts/ConnectAccountButton.tsx` | Implemented |
| `components/features/accounts/MockConsentDialog.tsx` | Implemented |
| `components/features/posts/PostStatusBadge.tsx` | Implemented |
| `components/features/posts/PostTargetRow.tsx` | **MISSING** |
| `components/features/posts/PostHistoryTable.tsx` | Implemented |
| `components/features/calendar/CalendarView.tsx` | **MISSING** |
| `components/features/calendar/CalendarDayCell.tsx` | **MISSING** |
| `components/features/calendar/ScheduledPostChip.tsx` | **MISSING** |
| `components/features/analytics/MetricsCard.tsx` | Implemented (demo) |
| `components/features/analytics/PostMetricsTable.tsx` | Implemented (demo) |

---

## 11. Architecture / Lib Modules

| Module | Status | Notes |
|---|---|---|
| `src/lib/db.ts` | Implemented | |
| `src/lib/auth.ts` | Partial | Missing Google provider. |
| `src/lib/validations/*` | Implemented | Extra files beyond SPEC list (`auth.ts`, `upload.ts`, `common.ts`). |
| `src/lib/platforms/types.ts`, `constraints.ts`, `registry.ts` | Implemented | |
| Mock adapters + `baseMock.ts` | Implemented | Missing retry behavior is in publisher, not adapter. |
| `src/lib/ai/provider.ts`, `openai.ts`, `prompts/adaptPost.ts` | Implemented | |
| SPEC path `src/lib/queue/publisher.ts` | Relocated | Actual file is `src/lib/posts/publisher.ts`. |
| `src/stores/composerStore.ts` | Implemented | Tone is not persisted/restored when loading a draft. |
| `src/types/index.ts` | Implemented | |

---

## 12. Missing Test Coverage

The existing test suite covers the publish-now MVP well. Missing coverage for:

- Scheduling / cron / overdue / `MISSED`
- Analytics refresh and snapshot persistence
- Google OAuth flow
- Post detail, `PATCH`/`DELETE` posts, concurrent-edit 409
- Publisher exponential backoff
- "Shorten with AI" action
- Per-platform upload-time validation

---

## Prioritized Gap List

### P0 — Blocks full MVP per SPEC.md
1. **Scheduling/Calendar end-to-end** — `SchedulePicker`, `/calendar`, `/api/cron/publish-due`, scheduled-target publisher worker, timezone conversion, overdue/`MISSED` logic.
2. **Analytics end-to-end** — `/api/analytics`, real `AnalyticsSnapshot` refresh, rate-limited "Refresh metrics".
3. **Google OAuth sign-in** — add Google provider to `src/lib/auth.ts` and wire the login button.
4. **Post detail + edit/reschedule/cancel** — create post detail page, add `PATCH`/`DELETE` to `/api/posts/[id]`, build `PostTargetRow`.

### P1 — Required edge-case behavior
5. **Publisher retry with exponential backoff** — 3 retries at 1s/4s/16s.
6. **"Shorten with AI" quick action** — on constraint violation in `PlatformVariantCard.tsx`.
7. **Per-platform upload-time validation** — `MediaUploader.tsx` should toast platform-specific violations.
8. **MISSED post "Publish now" action** — surface in dashboard with one-click publish.

### P2 — Polish / spec fidelity
9. Redirect new users to `/settings/accounts` per SPEC or document `/onboarding` deviation.
10. Persist `tone` in draft resume.
11. Surface "All targets cancelled" note when disconnect cancels every target.
12. Reconcile `PostTarget.accountId` nullable deviation with SPEC §6 or document rationale.
13. Add tests for all P0/P1 gaps.
