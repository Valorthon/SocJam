# SocJam

One workspace to draft, adapt, schedule, and publish to every social platform — without rewriting the same post five times.

**Live app deployment:  [https://socjam.up.railway.app](https://socjam.up.railway.app)**

Built in 72 hours by a 3-person team at a hackathon.

## The problem

Social media managers waste hours rewriting one announcement for X, Facebook, Instagram, TikTok, and LinkedIn. They juggle different upload flows, lose track of which posts went live, and have no safe way to retry a failed platform without risking duplicate posts on the ones that already succeeded.

## The solution

SocJam is a centralized social media control hub. You draft once, AI adapts the copy for each platform's rules, you review every variant, and then publish or schedule to all connected accounts in a single action. The dashboard tracks per-platform delivery status and gives you one-click retry on only the targets that failed.

## What it does

- **Unified composer** — write one base draft, then edit per-platform variants with live validation against each network's character limits, media rules, and required formats.
- **AI adaptation** — OpenAI or Groq generates platform-native variants based on constraints stored in one source-of-truth file. Output is always shown for review and is never auto-published.
- **Publish now or schedule** — publish immediately or pick a date and time in your own timezone.
- **Content calendar** — month and week views with scheduled-post chips and an upcoming queue.
- **Per-platform status tracking** — see exactly which platforms published, which failed, and why, with sanitized error messages.
- **Smart Retry** — retry only failed targets. Platforms that already succeeded are never republished.
- **Idempotent by default** — every publish and schedule action is guarded by UUID idempotency keys and atomic database transitions, so double-clicks, retries, and overlapping cron runs can never create duplicates.

## Platform integrations

| Platform | Status |
|---|---|
| **LinkedIn** | Live production integration |
| **TikTok** | Real integration, running in sandbox while awaiting production review |
| **Facebook & Instagram** | Real integration, running in sandbox while awaiting production review |
| **X** | Stubbed due to the X API paywall; mock adapter available for testing |

The app is already under review by Facebook, Insta, and Tiktok so it can be used it prod. However, production approval for TikTok, Facebook, and Instagram typically takes days to weeks which is way passed the time frame of the hackathon. In the meantime, the integrations are demoed in sandbox mode. The integrations are *real* it's just that they are restricted to users outside the dev team.

All platforms can also run behind deterministic mock adapters via `MOCK_PLATFORMS=true` for local development and testing.

## Architecture highlights

- **Adapter registry** — every platform interaction goes through the `SocialPlatformAdapter` interface. Feature code never calls a platform API directly, so swapping mock ↔ real is an env change.
- **Swappable AI provider** — the `AIProvider` interface supports OpenAI and Groq, with a deterministic mock fallback when no API key is configured.
- **Partial-failure state machine** — each target has its own status, so one platform can fail while the rest succeed, and retry re-attempts only the failures.
- **Encrypted tokens at rest** — social account access tokens are encrypted before being stored.

## Tech stack

Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, TanStack Query, Zustand, PostgreSQL, Prisma, Auth.js, Argon2.

## Quick start

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded dev credentials.

## Deployment

SocJam is Railway-ready. `railway.json` runs migrations automatically on every deploy.

## License

MIT License — Copyright (c) 2026 Rolfdood
