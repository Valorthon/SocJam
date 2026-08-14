# OmniPost

OmniPost is a centralized social media control hub that lets teams draft one
post, adapt it for multiple platforms, and publish it from one workspace. OmniPost is built with Next.js 14, TypeScript, Tailwind CSS,
shadcn/ui, TanStack Query, Zustand, PostgreSQL, Prisma, and Auth.js. Backend
planning and GitHub issue creation used GPT-5.6-Terra; implementation used a
mix of GPT-5.6-Terra and Luna in high-effort mode through Codex with the
Superpowers plugin.

## Prerequisites

- Node.js 20 or later
- pnpm 10 or later
- Docker (recommended) or a running PostgreSQL database

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the PostgreSQL database with Docker:

   ```bash
   docker compose up -d
   ```

   This creates a container named `omnipost-postgres` on port `5433` with the
   default credentials already reflected in `.env.example`.

3. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

   The default `DATABASE_URL` in `.env.example` matches the Docker Compose service.
   Update it only if you use your own PostgreSQL instance. Never commit `.env`.
   Configure the remaining values using [Environment configuration](#environment-configuration).

4. Generate Prisma Client:

   ```bash
   pnpm prisma generate
   ```

5. Apply database migrations:

   ```bash
   pnpm prisma migrate dev
   ```

6. Seed the development user:

   ```bash
   pnpm prisma db seed
   ```

   This creates the development account listed in [Test credentials](#test-credentials).

7. Start the development server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment configuration

Local development reads configuration from `.env`. Start by copying
`.env.example`, then fill in only the values needed for the flow you want to
test.

| Variable | Required for local testing? | What to set |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. The default works with `docker compose up -d`: `postgresql://omnipost:omnipost@localhost:5433/omnipost?schema=public`. |
| `AUTH_URL` | Yes | Local app URL, usually `http://localhost:3000`. |
| `AUTH_SECRET` | Yes | Secret used by Auth.js to sign/encrypt auth state. Generate a local value with `openssl rand -base64 32` or `node -e "console.log(crypto.randomBytes(32).toString('base64'))"`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Only needed when testing Google OAuth. Leave blank for credentials login. |
| `AI_PROVIDER` | Optional | AI provider name. Use `openai` by default or `groq` when testing Groq. |
| `AI_MODEL` | Optional | Model sent to the selected provider. Defaults are `gpt-4o-mini` for OpenAI and `llama-3.3-70b-versatile` for Groq. |
| `OPENAI_API_KEY` | Optional | Required only when `AI_PROVIDER="openai"` should call the OpenAI API. Leave blank to use deterministic mock AI output. |
| `GROQ_API_KEY` | Optional | Required only when `AI_PROVIDER="groq"` should call Groq. Leave blank to use deterministic mock AI output. |
| `AI_DAILY_LIMIT` | Optional | Daily AI generation quota per user. Defaults to `20`. |
| `MOCK_PLATFORMS` | Yes for MVP | Keep `true` for local testing; real platform adapters are not part of the current demo scope. |
| `MOCK_FAILURE_RATE` | Optional | Number from `0` to `1` used to simulate platform publish failures. Use `0` for normal local testing. |
| `UPLOAD_DIR` | Optional | Local folder for uploaded media. Defaults to `./uploads`. |
| `CRON_SECRET` | Optional | Reserved for scheduled publishing/cron testing. Can stay blank for current composer and publish-now flows. |

Minimal `.env` values for local credentials login and mock AI/platform testing:

```env
DATABASE_URL="postgresql://omnipost:omnipost@localhost:5433/omnipost?schema=public"
AUTH_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-generated-local-secret"
AI_PROVIDER="openai"
AI_MODEL="gpt-4o-mini"
OPENAI_API_KEY=""
GROQ_API_KEY=""
AI_DAILY_LIMIT="20"
MOCK_PLATFORMS="true"
MOCK_FAILURE_RATE="0"
UPLOAD_DIR="./uploads"
```

Set `OPENAI_API_KEY` or `GROQ_API_KEY` only when you want to test real AI
provider calls. With the selected provider key left blank, OmniPost returns
deterministic mock variants so the app can be tested offline.

## Test credentials

> [!IMPORTANT]
> Run `pnpm prisma db seed` before using these development-only credentials.

| Email | Password |
| --- | --- |
| `dev@omnipost.local` | `password123` |

## Authentication

The app uses **Auth.js / NextAuth v5** with credentials-based authentication:

- **Sign up:** [http://localhost:3000/signup](http://localhost:3000/signup)
- **Sign in:** [http://localhost:3000/login](http://localhost:3000/login)
- Passwords are hashed with **argon2**
- Failed login attempts are throttled (>5 failures in 15 min blocks the account)

## Current demo scope

- Connect mocked X, Facebook, Instagram, TikTok, and LinkedIn accounts.
- Draft platform-specific post variants, validate their platform rules, and use
  AI suggestions that always require review before publishing.
- Publish through mock adapters, view persisted post statuses in the dashboard,
  and retry only failed targets.
- Media is uploaded to local server storage, persisted with each post, and
  validated against every selected platform before publishing.
- Analytics is a static demo preview. Scheduling and the calendar are not yet
  available.

## AI adaptation and mock publishing

The adaptation endpoint uses OpenAI by default (`AI_PROVIDER="openai"`) with
the `gpt-4o-mini` model. Configure `OPENAI_API_KEY` to use the API, or set
`AI_PROVIDER="groq"`, `AI_MODEL="llama-3.3-70b-versatile"`, and
`GROQ_API_KEY` to use Groq instead. `AI_MODEL` overrides the selected
provider's default model. Without a key for the selected provider, OmniPost
returns deterministic mock variants so the demo remains runnable offline.
AI-generated text is always returned for review; it is never published
automatically.

Mock platform publishing is enabled by default with `MOCK_PLATFORMS="true"`.
Set `MOCK_FAILURE_RATE` to a value between `0` and `1` before starting the app
to exercise failed-target status and retry behavior. A retry only republishes
targets whose persisted status is `FAILED`; previously published targets remain
untouched. Failures are deterministic for a target while the failure rate is
unchanged, so set `MOCK_FAILURE_RATE="0"` and restart the app before retrying
when demonstrating a recovery after a simulated failure.

## Demo journey

1. Start the database, apply migrations, seed the app, and run `pnpm dev`.
2. Sign in with `dev@omnipost.local` / `password123`.
3. Connect mock X, LinkedIn, and Instagram accounts.
4. Draft a post, request AI adaptations, review one variant, and publish.
5. Restart with a non-zero `MOCK_FAILURE_RATE` to demonstrate a failed target,
   then retry it from the post detail view.

## Verification commands

Run these individually to confirm the health of the codebase:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm prisma generate
```

## Database commands

```bash
pnpm prisma migrate dev      # create / apply migrations
pnpm prisma db seed          # seed development data
pnpm prisma studio           # open database GUI
```

## Stopping the database

```bash
docker compose down
```

To remove the database volume as well:

```bash
docker compose down -v
```
