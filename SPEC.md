# App Specification: SocJam — Centralized Social Media Control Hub

> Working title "SocJam" — rename freely. This spec is written to be handed to an AI coding agent. It is deliberately explicit about architecture, failure modes, and where files go.

---

## 1. Project Context & Goal

**What are we building:**
A centralized web app where social media managers draft one post, let AI adapt it into platform-native versions, and publish or schedule it to X (Twitter), Facebook, Instagram, TikTok, and LinkedIn in a single action — then track per-platform delivery status and basic metrics from one dashboard.

**Target Audience:**
Social media managers, marketing teams, influencers/creators, and product/project marketers who currently re-write and re-post the same content across multiple networks.

**Primary Metric for Success:**
A user can connect ≥2 (mocked) social accounts, draft one post, generate AI per-platform adaptations, publish or schedule it to all selected platforms in one action, and see per-platform delivery status in the dashboard — without re-writing the post per platform.

Secondary metrics:
- Time from draft → published on 5 platforms < 2 minutes.
- % of posts published with zero manual per-platform edits (AI adaptation acceptance rate).
- 0 duplicate publishes of the same target (idempotency).

---

## 2. Tech Stack & Hard Constraints

> [!IMPORTANT]
> Do NOT deviate from these tools or introduce new dependencies without asking first.

- **Framework:** Next.js 14 (App Router) + TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** TanStack Query for all server state; Zustand for composer UI state only. No Redux, no Context-based server cache.
- **Database / ORM:** PostgreSQL + Prisma. All DB access happens in server code (route handlers / server actions) only — never import Prisma into client components.
- **Auth:** Auth.js (NextAuth v5) with the Prisma adapter. Email/password (credentials, hashed with argon2) + Google OAuth.
- **AI:** OpenAI API accessed behind an `AIProvider` interface (default model `gpt-4o-mini`, overridable via env var). Must be swappable for another provider without touching feature code.
- **Scheduling:** Database-backed job state on `PostTarget` + a secured cron route `/api/cron/publish-due` invoked every minute (Vercel Cron or external pinger). Publisher must be idempotent.
- **Media Storage:** `MediaStorage` interface; local disk (`/uploads`) implementation for MVP, S3-compatible implementation later. No direct filesystem calls outside the interface.
- **Platform Integration:** A `SocialPlatformAdapter` interface (see §7). MVP ships **mock adapters** for all 5 platforms behind `MOCK_PLATFORMS=true`. No feature code may call a platform API directly — everything goes through the adapter registry.

**Strict Rules:**
1. TypeScript strict mode. No `any` without an `// eslint-disable` justification comment.
2. All components functional with hooks. No class components.
3. Mobile-first responsive design; the composer must be fully usable at 375px width.
4. Zod-validate every API route input and every AI/adapter output at the boundary.
5. All datetimes stored in UTC; rendered in the user's timezone (stored on the `User` record).
6. Per-platform rules (char limits, media requirements) live in ONE file (`constraints.ts`) and are the single source of truth for both UI validation and server validation.
7. Every publish attempt must be idempotent — see §5, items 1–2.
8. No new npm dependencies without asking first.

---

## 3. File Structure (Target State)

```
prisma/
  schema.prisma
src/
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
    (app)/
      layout.tsx                    # sidebar + topbar shell, auth guard
      dashboard/page.tsx            # post history + status
      compose/page.tsx
      calendar/page.tsx
      analytics/page.tsx
      settings/accounts/page.tsx
    api/
      auth/[...nextauth]/route.ts
      accounts/route.ts             # GET list, POST connect (mock OAuth)
      accounts/[id]/route.ts        # DELETE disconnect (cascade rules §5.8)
      posts/route.ts                # GET list, POST create (idempotency key)
      posts/[id]/route.ts           # GET detail, PATCH edit/reschedule, DELETE
      posts/[id]/publish/route.ts   # POST publish-now
      posts/[id]/retry/route.ts     # POST retry failed targets only
      ai/adapt/route.ts             # POST per-platform AI adaptation
      analytics/route.ts            # GET dashboard aggregates, POST refresh snapshots
      cron/publish-due/route.ts     # POST, secured by CRON_SECRET header
      uploads/route.ts              # POST media upload via MediaStorage
  components/
    ui/                             # shadcn primitives only
    features/
      composer/
        Composer.tsx
        PlatformSelector.tsx
        PlatformVariantCard.tsx     # editable per-platform text + char counter + validation state
        AiAdaptPanel.tsx
        MediaUploader.tsx
        SchedulePicker.tsx
      accounts/
        AccountCard.tsx
        ConnectAccountButton.tsx
        MockConsentDialog.tsx       # simulated OAuth consent screen
      posts/
        PostStatusBadge.tsx
        PostTargetRow.tsx           # platform, status, published URL, error, retry
        PostHistoryTable.tsx
      calendar/
        CalendarView.tsx
        CalendarDayCell.tsx
        ScheduledPostChip.tsx
      analytics/
        MetricsCard.tsx
        PostMetricsTable.tsx
  lib/
    db.ts                           # Prisma singleton
    auth.ts                         # Auth.js config
    utils.ts
    validations/                    # zod schemas shared by client + server
      post.ts
      account.ts
      ai.ts
    platforms/
      types.ts                      # SocialPlatformAdapter, PublishInput, PublishResult, PlatformConstraints
      constraints.ts                # SINGLE SOURCE OF TRUTH for per-platform limits
      registry.ts                   # platform -> adapter resolution (mock vs real by env)
      adapters/
        baseMock.ts                 # shared mock behavior incl. failure simulation
        mockX.ts
        mockFacebook.ts
        mockInstagram.ts
        mockTikTok.ts
        mockLinkedIn.ts
    ai/
      provider.ts                   # AIProvider interface
      openai.ts                     # OpenAI implementation
      prompts/adaptPost.ts          # prompt template incl. per-platform constraints
    queue/
      publisher.ts                  # idempotent due-target publishing (used by cron route)
    storage/
      types.ts                      # MediaStorage interface
      local.ts                      # /uploads disk implementation
  stores/
    composerStore.ts                # Zustand: draft, selected platforms, per-platform variants
  types/
    index.ts                        # shared DTO types
```

---

## 4. Feature Requirements (The "What")

### Feature 1: Auth (Sign Up / Log In / Log Out)

- **UI/UX:** Login page: email input, password input, "Forgot password?" link (stub — renders "Coming soon" modal), "Sign in with Google" button, submit button, link to signup. Signup page: name, email, password, confirm password, submit.
- **Logic:** On submit, validate with zod (email format, password ≥ 8 chars). Credentials: hash with argon2, verify via Auth.js. On success redirect to `/dashboard`. Google OAuth creates the `User` on first login. New users land on `/settings/accounts` with an empty-state prompt to connect their first account.
- **Error Handling:** Wrong password → red text below form: "Invalid email or password." Duplicate email on signup → "An account with this email already exists." >5 failed login attempts in 15 min → throttle: "Too many attempts. Try again in 15 minutes." OAuth error → toast with sanitized message.

### Feature 2: Connect Social Accounts (Mocked OAuth)

- **UI/UX:** `/settings/accounts` shows 5 platform cards (X, Facebook, Instagram, TikTok, LinkedIn): platform logo, connect button; when connected: handle, avatar placeholder, status pill (`Connected` green / `Reconnect required` amber), Disconnect button.
- **Logic:** Connect opens `MockConsentDialog` simulating an OAuth consent screen: user enters a mock handle (e.g. `@acme`), clicks "Authorize" → creates `SocialAccount` with a fake token and `ACTIVE` status. Real adapters are a later phase; the entire flow is behind the adapter registry so swapping in real OAuth changes only this feature and the adapter.
- **Error Handling:** User clicks "Cancel" in consent dialog → no record created, no error shown (deliberate cancel). Duplicate connect (same platform + handle) → "This account is already connected." Disconnect when the account has scheduled posts → confirmation dialog: "This account has N scheduled posts. Disconnecting will cancel them." → on confirm, cascade-cancel those `PostTarget`s (status `CANCELLED`) and recompute parent post status.

### Feature 3: Unified Composer

- **UI/UX:** `/compose`:
  - Base draft textarea with live character count.
  - `MediaUploader`: multi-file select, thumbnail previews, remove button per item.
  - `PlatformSelector`: chip per connected account (platform icon + handle); only connected+active accounts selectable; `Reconnect required` accounts shown disabled with tooltip.
  - "Adapt with AI" button (see Feature 4).
  - `PlatformVariantCard` per selected platform: editable textarea pre-filled with base text, live char counter against that platform's limit, per-card validation messages, media-requirement indicator (e.g. "Instagram requires an image ✓").
  - Footer: "Publish now" and "Schedule" buttons; both disabled until every selected target is valid.
- **Logic:** Selecting a platform creates an in-memory variant initialized from the base draft. User edits to the base draft propagate to variants **only if the variant is unedited** (track `isManuallyEdited` per variant — once the user touches a variant, base edits stop flowing to it). Validation runs continuously against `constraints.ts`.
- **Error Handling:** Publish/Schedule clicked with invalid targets → scroll to first invalid card, inline red messages (e.g. "Over 280 character limit by 42"). No platform selected → buttons disabled with helper text "Select at least one platform." Media rejected at upload (unsupported type, > size limit for any selected platform) → toast naming the failing platform and rule.

### Feature 4: AI Per-Platform Adaptation

- **UI/UX:** "Adapt with AI" button in composer; optional tone selector (Professional / Casual / Playful / Bold). While generating: shimmer skeleton on each variant card, button shows spinner. After generation: each card shows an "AI" badge, a "Regenerate" icon-button, and remains fully editable.
- **Logic:** `POST /api/ai/adapt` with `{ baseText, platforms[], tone, media: { hasImages, hasVideo } }`. Server builds a prompt per platform from `prompts/adaptPost.ts` including that platform's hard constraints (char limit, hashtag norms, tone norms, media requirements) and returns one variant per platform. Response zod-validated; variants written into the composer store. Regenerating a card the user has manually edited requires a confirmation ("Replace your edits?"). AI outputs are NEVER auto-published — the user always reviews and presses Publish/Schedule.
- **Error Handling:** AI request timeout (30s) or provider error → toast "AI adaptation failed" + each affected card gets "AI failed — using your draft" state with the base text and a Retry button. Rate limit (20 generations/user/day, env-configurable) → friendly message with remaining count shown on the button. AI output that violates a platform constraint → card flagged invalid with "Shorten with AI" quick-action that regenerates with an explicit length instruction. Empty base text → "Adapt with AI" disabled.

### Feature 5: Publish Now + Per-Platform Status Tracking

- **UI/UX:** After publish → redirect to post detail (`/dashboard` row → detail): base content, media, and a `PostTargetRow` per platform: platform icon, status badge (`Queued` / `Publishing` / `Published` / `Failed`), published URL when available (mock URL in MVP), sanitized error text when failed, "Retry" button on failed rows. Post-level badge derived from targets: `Published` (all), `Partially failed` (some), `Failed` (all).
- **Logic:** `POST /api/posts` accepts a client-generated `idempotencyKey` (uuid generated when the composer mounts) — unique constraint prevents double-creation from double-clicks/retries. Publish transitions each target to `PUBLISHING` and calls its adapter's `publishPost`. Each target succeeds/fails independently. On adapter auth failure → target `FAILED` with reconnect CTA and the account flips to `RECONNECT_REQUIRED`.
- **Error Handling:** Adapter throws → target `FAILED` with sanitized message (never raw API/stack text in the UI). All targets fail → post `FAILED`, toast on redirect, Retry-all button. Duplicate submit (double-click, back-button resubmission) → button disabled+loading during flight; server returns the existing post for a repeated idempotency key instead of creating a new one.

### Feature 6: Scheduling + Content Calendar

- **UI/UX:** `SchedulePicker` in composer: date + time inputs labeled with the user's timezone, quick presets ("In 1 hour", "Tomorrow 9:00"). `/calendar`: month and week views; each scheduled post is a chip showing time + platform icons; click chip → post detail. Side panel: chronological "Upcoming queue" list. Post detail for a `SCHEDULED` post allows editing content, changing time, or cancelling.
- **Logic:** `scheduledAt` stored UTC; picker converts from the user's timezone. Cron route (every minute, secured with `CRON_SECRET` header) calls `queue/publisher.ts`: select due targets (`status = SCHEDULED AND scheduledAt <= now()`) with `FOR UPDATE SKIP LOCKED`, transition to `PUBLISHING` (this status transition is the idempotency guard — a target can only leave `SCHEDULED` once), publish via adapter, set final status. Reschedule/edit allowed only while the post is `SCHEDULED`.
- **Error Handling:** Scheduling in the past → validation error "Scheduled time must be in the future." Scheduling to an account that is later disconnected → at publish time the target fails with reconnect CTA (and account flagged). Cron downtime → on the next run the publisher catches up: targets ≤ 1 hour overdue are published; targets > 1 hour overdue are marked `MISSED` (never silently posted late) and surfaced in the dashboard with a "Publish now" action. Concurrent edits from two tabs → `updatedAt` optimistic-concurrency check; loser gets 409 → "This post was modified elsewhere. Reload to see changes."

### Feature 7: Basic Analytics Dashboard

- **UI/UX:** `/analytics`: top row of `MetricsCard`s (Posts this month, Published, Scheduled, Failed, Partial failures). `PostMetricsTable`: one row per published target — post excerpt, platform, impressions, likes, comments, shares, "last synced HH:MM" timestamp. "Refresh metrics" button (rate-limited to once / 5 min).
- **Logic:** Mock adapters return **deterministic** pseudo-random metrics seeded from the target id (same target → same base numbers, slowly growing over time) so demos and tests are stable. Refresh stores an `AnalyticsSnapshot` per published target; the UI always renders the latest snapshot.
- **Error Handling:** Snapshot fetch fails → keep displaying last snapshot with an amber "Stale data" badge and the original timestamp. Target not published yet → row shows "Not published yet", no metrics. Never fabricate metrics client-side.

---

## 5. Edge Cases & "Unhappy Paths"

1. **Partial platform failure (the defining case).** 3 of 5 targets succeed → post status = `PARTIALLY_FAILED`. Successful targets keep their published URLs; failed targets show individual errors and individual Retry buttons. `POST /posts/[id]/retry` re-attempts **only** failed targets — never re-publishes succeeded ones (that would create duplicate platform posts).
2. **Duplicate submission.** Client: submit button disables + shows spinner on first click; idempotency key generated per composer session. Server: unique `idempotencyKey` on `Post`; repeated key returns the existing post (HTTP 200), never a duplicate. Cron publisher: the `SCHEDULED → PUBLISHING` transition is atomic (`UPDATE ... WHERE status = 'SCHEDULED'` / `SELECT ... FOR UPDATE SKIP LOCKED`), so two overlapping cron runs can never publish the same target twice.
3. **Expired/revoked account token.** Adapter `checkAuth` fails at publish time → target `FAILED` with "Reconnect your {platform} account" CTA, account status → `RECONNECT_REQUIRED`, composer disables that account with an explanatory tooltip. Reconnecting restores normal behavior; previously failed targets remain manually retryable.
4. **Scheduling edge cases.** Past time → blocked at validation. Timezone/DST: all storage UTC, picker converts from user profile timezone; ambiguous DST times resolve to the first occurrence. Account disconnected between scheduling and publish → target fails at publish time per item 3.
5. **Media rule violations.** Instagram target with no image, TikTok target with no video, >4 images on X, unsupported file type, or file over the platform size limit → flagged at upload time AND re-validated server-side at publish/schedule time (never trust the client). Rules come only from `constraints.ts`. Cron-published posts are re-validated at publish time; a now-invalid target fails with a clear message instead of publishing bad content.
6. **AI failures.** Provider timeout (30s) → per-card fallback to base draft + retry. Provider rate limit → message + remaining-quota display. AI output violating a constraint → invalid flag + "Shorten with AI" action; never silently truncate user-facing text. AI output fails zod validation → treat as provider error.
7. **Empty/invalid composer states.** No platforms selected, empty text AND no media, all variants invalid → publish/schedule disabled with specific helper text. A platform whose requirements can never be met by current media (e.g. TikTok with only images) shows its blocking message on the card.
8. **Disconnecting an account with scheduled posts.** Confirmation dialog states the count; on confirm, its `SCHEDULED` targets → `CANCELLED` and parent posts recompute status (a post whose remaining targets are all cancelled becomes `FAILED` with note "All targets cancelled").
9. **Cron downtime / missed window.** Overdue ≤ 1 hour → publish on catch-up. Overdue > 1 hour → `MISSED`, surfaced on dashboard with one-click "Publish now". Never silently publish stale content.
10. **Stale analytics.** Fetch failure → keep last snapshot, show "Stale data" badge + original timestamp. Unpublished target → "Not published yet" state.
11. **Concurrent edits.** Two tabs editing one scheduled post → `updatedAt` check; second save gets 409 and a "modified elsewhere, reload" message. No silent last-write-wins.
12. **Simulated platform outages.** Mock adapters support a failure-simulation toggle (env var `MOCK_FAILURE_RATE`, 0–1) so every unhappy path above is testable in dev. Publisher retries a failed adapter call up to 3× with exponential backoff (1s, 4s, 16s) before marking the target `FAILED`.
13. **Network loss during publish from the browser.** No optimistic "Published" states — UI only reflects server-confirmed statuses; a refresh reconciles from the DB.
14. **Upload failures.** File > 25MB hard cap, non-image/non-video types → rejected client- and server-side with a specific message. Partial multi-file upload failure → successful files kept, failed ones listed with retry.

---

## 6. Data Model (Prisma Sketch)

```prisma
enum Platform     { X FACEBOOK INSTAGRAM TIKTOK LINKEDIN }
enum AccountStatus { ACTIVE RECONNECT_REQUIRED }
enum PostStatus   { DRAFT SCHEDULED PUBLISHING PUBLISHED PARTIALLY_FAILED FAILED }
enum TargetStatus { DRAFT SCHEDULED PUBLISHING PUBLISHED FAILED CANCELLED MISSED }
enum MediaType    { IMAGE VIDEO }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?
  name         String?
  timezone     String   @default("UTC")
  accounts     SocialAccount[]
  posts        Post[]
  createdAt    DateTime @default(now())
}

model SocialAccount {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform    Platform
  handle      String
  accessToken String        // mock value in MVP; encrypt at rest before real OAuth
  status      AccountStatus @default(ACTIVE)
  targets     PostTarget[]
  @@unique([userId, platform, handle])
}

model Post {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  baseText       String
  status         PostStatus @default(DRAFT)
  scheduledAt    DateTime?
  idempotencyKey String    @unique
  targets        PostTarget[]
  media          MediaAsset[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model PostTarget {
  id           String      @id @default(cuid())
  postId       String
  post         Post        @relation(fields: [postId], references: [id], onDelete: Cascade)
  accountId    String
  account      SocialAccount @relation(fields: [accountId], references: [id])
  platform     Platform
  adaptedText  String
  status       TargetStatus @default(DRAFT)
  scheduledAt  DateTime?
  publishedAt  DateTime?
  publishedUrl String?
  error        String?
  attempts     Int         @default(0)
  analytics    AnalyticsSnapshot[]
  @@unique([postId, accountId])
  @@index([status, scheduledAt])   // due-target scan
}

model MediaAsset {
  id        String    @id @default(cuid())
  postId    String
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  url       String
  type      MediaType
  sizeBytes Int
  width     Int?
  height    Int?
  order     Int       @default(0)
}

model AnalyticsSnapshot {
  id          String     @id @default(cuid())
  targetId    String
  target      PostTarget @relation(fields: [targetId], references: [id], onDelete: Cascade)
  impressions Int
  likes       Int
  comments    Int
  shares      Int
  fetchedAt   DateTime   @default(now())
  @@index([targetId, fetchedAt])
}

model AiGeneration {
  id        String   @id @default(cuid())
  userId    String
  platform  Platform
  prompt    String
  output    String
  model     String
  createdAt DateTime @default(now())
}
```

---

## 7. Platform Adapter Interface (Architectural Keystone)

All platform interaction goes through this interface. MVP ships mock implementations; real API adapters slot in later without touching feature code.

```ts
// src/lib/platforms/types.ts
export interface PlatformConstraints {
  maxChars: number;
  maxImages: number;
  requiresImage: boolean;
  requiresVideo: boolean;
  maxVideoSeconds: number;
  maxFileSizeMB: number;
  supportedMediaTypes: string[];   // mime types
}

export interface PublishInput {
  idempotencyKey: string;          // adapters must treat repeats as no-ops
  text: string;
  media: MediaAsset[];
  account: SocialAccount;
}

export type PublishResult =
  | { ok: true; publishedUrl: string }
  | { ok: false; error: string; authExpired?: boolean; retryable: boolean };

export interface SocialPlatformAdapter {
  readonly platform: Platform;
  getConstraints(): PlatformConstraints;
  validatePost(input: PublishInput): { valid: boolean; errors: string[] };
  publishPost(input: PublishInput): Promise<PublishResult>;
  checkAuth(account: SocialAccount): Promise<{ active: boolean }>;
  fetchAnalytics(target: PostTarget): Promise<{
    impressions: number; likes: number; comments: number; shares: number;
  }>;
}
```

Reference constraints for `constraints.ts` (verify against official docs when building real adapters):

| Platform | maxChars | requiresImage | requiresVideo | maxImages | Notes |
|---|---|---|---|---|---|
| X | 280 | no | no | 4 | URLs count toward limit |
| Facebook | 63,206 | no | no | — | Long-form OK |
| Instagram | 2,200 | **yes** | no | 10 (carousel) | Caption limit 2,200 |
| TikTok | 2,200 | no | **yes** | 0 | Video required |
| LinkedIn | 3,000 | no | no | 9 | Professional tone norm |

Mock adapter behavior (`baseMock.ts`): ~600ms artificial latency, returns `https://mock.{platform}.local/post/{targetId}`, deterministic analytics seeded from target id, honors `MOCK_FAILURE_RATE` for failure simulation.

---

## 8. Environment Variables

```
DATABASE_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
MOCK_PLATFORMS=true
MOCK_FAILURE_RATE=0
CRON_SECRET=
UPLOAD_DIR=./uploads
AI_DAILY_LIMIT=20
```

---

## 9. Out of Scope (MVP) / Future Phases

**Out of scope for MVP:** comments/DM management, team workspaces & roles, real platform OAuth (Phase 2), video editing/thumbnails, best-time-to-post suggestions, hashtag research, mobile apps, SSO.

**Phase 2:** Replace mock adapters one platform at a time (suggested order: LinkedIn → Facebook/Instagram (Graph API) → TikTok → X), starting with real OAuth flows. The adapter registry makes this a per-platform change with zero feature-code edits. Add webhook-based analytics sync. Team workspaces with role-based posting approval.
