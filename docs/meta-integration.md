# Phase 2a — Meta (Facebook + Instagram) Integration Guide

This phase wires up **real Meta Graph API OAuth** for Facebook and Instagram account connection, plus **real Facebook Page publishing**. Instagram account connection also goes through real OAuth, but **Instagram publishing stays on the mock adapter** in this phase — see [Why Instagram publish is deferred](#why-instagram-publish-is-deferred) below.

The architecture is unchanged from the MVP seam: every platform interaction still goes through the `SocialPlatformAdapter` interface. The registry now routes Facebook to either the mock or `RealFacebookAdapter` based on the `REAL_FACEBOOK` env flag, with no change to feature code.

## 1. Create a Meta for Developers app

1. Go to <https://developers.facebook.com/> and create a new app.
2. Choose **Business** as the app type.
3. Add two products to the app:
   - **Facebook Login** (for the OAuth flow).
   - **Instagram Graph API** (for IG business-account discovery).
4. From **App settings → Basic**, copy your `App ID` and `App Secret` into `.env`:
  ```
  META_APP_ID=...
  META_APP_SECRET=...
  ```

## 2. Configure the OAuth redirect URI

Under **Facebook Login → Settings**, add the redirect URI to the **Valid OAuth Redirect URIs** list:

```
http://localhost:3000/api/oauth/meta/callback
```

(The same in `.env` as `META_REDIRECT_URI`.)

For production, you'll also add `https://your-domain.com/api/oauth/meta/callback`. **Both URIs can live alongside each other** — the value in `META_REDIRECT_URI` is the one OmniPost actually requests.

## 3. Generate an encryption key

```
openssl rand -base64 32
```

Copy the result into `.env`:

```
APP_ENCRYPTION_KEY=<that-base64-string>
```

This key encrypts Meta access tokens at rest (REQUIRED before flipping any `REAL_*` flag — SPEC §6).

## 4. Enable real adapters (per platform)

`.env`:

```
REAL_FACEBOOK="true"
REAL_INSTAGRAM="true"
```

`REAL_INSTAGRAM="true"` only takes effect when `REAL_FACEBOOK="true"` too, because IG connect reuses the FB OAuth flow + Page scoping.

## 5. Test the OAuth flow

You'll need a real Facebook test account that:
- Owns at least one **Facebook Page** (even an empty one is enough)
- Optionally has an **Instagram business/creator account** linked to that Page

Link an IG business account to a Page in Meta Business Suite → Instagram → Connect.

Then:

1. Start your dev server: `pnpm dev`.
2. Make sure your DB is migrated: `pnpm prisma migrate dev`.
3. Sign in. Go to **Settings → Connected accounts**.
4. Click **Facebook**. The browser will redirect to `facebook.com`, prompt for consent, then bounce you to `/settings/accounts/pick-page` showing every Page your account manages.
5. Pick a Page. You'll be returned to `/settings/accounts` with a success toast and the new account row.
6. To test Instagram connect: pick the **Add platform → Instagram** flow. The same Meta OAuth consent runs; the page picker will only let you pick a Page **with an Instagram business account linked**, and the connected row will show the IG `@username`.
7. Compose a post, select the Facebook Page as the target, and click **Publish now**. The post will appear on the real Facebook Page, with the real permalink shown in the post-detail target row.

## 6. Schedule the token-refresh cron

Meta **long-lived user access tokens** expire after ~60 days. OmniPost refreshes them weekly via `POST /api/cron/refresh-tokens`.

Configure Vercel Cron (or any external pinger) to hit this endpoint every day:

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/refresh-tokens", "schedule": "0 3 * * *" }
  ]
}
```

The route is secured with the existing `CRON_SECRET` env var — every request must carry `x-cron-secret: <CRON_SECRET>` header. If the refresh fails (token revoked, etc.), OmniPost flips the matching `SocialAccount` to `RECONNECT_REQUIRED` and surfaces the CTA to the user.

## 7. App Review (for users beyond the dev team)

Until your app passes Meta's **App Review** for the following permissions, only listed admins/developers/testers can connect their real Facebook Pages:

- `pages_manage_posts`
- `pages_read_engagement`
- `pages_manage_engagement`
- `instagram_basic`
- `instagram_content_publish`
- `business_management`

Submit for review under **App Review → Permissions and Features**. Publishing posts on behalf of other users is the use case they review for.

You'll also need to complete **Business Verification** for the company that owns the app.

Local dev does not require App Review — adding yourself as an App Admin/Developer/Tester is enough.

## 8. Local testing

The full test surface splits into three layers: the **unit/integration suite** (no Meta app required), the **mock-fallback smoke test** (no Meta app required), and the **live OAuth + publish flow** (Meta app required — see §1–5 above). Run them in that order.

### 8.1 Prerequisites

```bash
pnpm install
pnpm prisma migrate dev    # applies the 20260814180000_add_meta_oauth_columns migration
```

You do **not** need a real Meta app, a Facebook account, or any of the `META_*` / `APP_ENCRYPTION_KEY` env vars to run the unit suite or the mock-fallback smoke test. Only the live-flow section (§8.4) requires them.

### 8.2 Unit / integration suite (no Meta app required)

```bash
pnpm test
```

This runs all 21 suites. The 5 added by this phase are:

| Suite | What it asserts |
|---|---|
| `tests/crypto.test.ts` | AES-256-GCM round trip, tamper detection, key-mismatch rejection, missing/malformed `APP_ENCRYPTION_KEY` surfaces as a typed error. |
| `tests/meta-oauth.test.ts` | PKCE verifier/challenge shape, HMAC-signed `state` encode/decode, tamper rejection, `buildAuthUrl` contains the required scopes + S256 challenge. |
| `tests/registry.test.ts` | `REAL_FACEBOOK=true` routes to `RealFacebookAdapter`; `false` falls back to mock; IG special-case: `REAL_INSTAGRAM=true` reports "real" for connect mode but `getPlatformAdapter("INSTAGRAM")` still returns the mock. |
| `tests/real-facebook-adapter.test.ts` | Successful publish → correct permalink; 401 / Graph code 190 → `authExpired: true`; 429 → retryable; raw Meta error body **never** leaks; network failure → retryable (no exception); `fetchAnalytics` throws `AnalyticsNotImplementedError`. Stubs `globalThis.fetch` — no real Graph calls. |
| `tests/refresh-tokens.test.ts` | `CRON_SECRET` guard (missing/empty/wrong/all correct); happy refresh path; decrypt failure → `RECONNECT_REQUIRED`; Graph refresh failure → `RECONNECT_REQUIRED`; missing Meta config → 500-style error. |

Plus the existing 16 suites still pass — the only changes to them were adding the 4 new nullable columns to the `SocialAccount` fixture objects.

Typecheck and lint run separately:

```bash
pnpm tsc --noEmit    # strict mode, no errors
pnpm lint            # next/core-web-vitals, no warnings
```

### 8.3 Mock-fallback smoke test (no Meta app required)

Verifies the registry falls back to mocks cleanly and the existing UI flow still works when no real adapters are configured.

1. In `.env`, leave (or set) `REAL_FACEBOOK=false` and `REAL_INSTAGRAM=false`. The `META_*` and `APP_ENCRYPTION_KEY` vars can be empty.
2. `pnpm dev`.
3. Sign in and go to `/settings/accounts`.
4. Click any platform (including Facebook and Instagram) → the `MockConsentDialog` opens (not a redirect to facebook.com). Connect a mock account.
5. Compose a post targeting the FB/IG row you just connected → **Publish now** → the target row shows `Published` with a `https://mock.{platform}.local/post/...` URL.
6. Repeat with `REAL_FACEBOOK=true` (leave `META_*` empty) and restart `pnpm dev` → the account page now redirects FB to `/api/oauth/meta/start`, which returns 503 with `{ error: "Meta OAuth is not configured on the server." }`. The other 4 platforms still go through the mock dialog. **This is the expected failure mode when env is inconsistent** — it tells you a real flag is on but Meta config is missing rather than silently failing.

### 8.4 Live OAuth + publish flow (Meta app required)

Follow §1–5 first. Then:

1. Confirm `.env` has `REAL_FACEBOOK=true`, `REAL_INSTAGRAM=true`, plus the `META_*` block and `APP_ENCRYPTION_KEY`.
2. `pnpm prisma migrate dev` (run once if you haven't).
3. `pnpm dev`.
4. In your browser: `/settings/accounts` → **Facebook** → facebook.com consent screen → `/settings/accounts/pick-page` → choose a Page → back to `/settings/accounts` with a success toast. A new row should appear with the Page name as the handle.
5. Repeat for Instagram: **Add platform → Instagram** → same Meta consent → picker only shows Pages with an IG business account → pick one → new IG row appears with the IG `@username` handle.
6. `/compose` → type text → select the Facebook Page target → **Publish now**. The post-detail target row should show `Published` with a real permalink like `https://www.facebook.com/<pageId>_<postId>`. Verify on the real Page in a separate tab.
7. Publish an Instagram target too — it resolves to `https://mock.instagram.local/post/...` by design (see §"Why Instagram publish is deferred"). The row still goes to `Published` and the account row remains active.

If the OAuth redirect fails, the URL returns to `/settings/accounts?oauth_error=<code>`. The codes and their meanings are mapped in the `OAUTH_ERROR_MESSAGES` table inside `src/app/(app)/settings/accounts/page.tsx`:

| `oauth_error` | Meaning |
|---|---|
| `oauth_canceled` | You clicked Cancel on Meta's consent screen. |
| `missing_code` / `missing_state` | Meta did not return `code` or you started without a session cookie. |
| `state_mismatch` / `invalid_state` | The signed `state` cookie didn't match (or the HMAC failed). |
| `token_exchange_failed` | `POST /oauth/access_token` returned a non-200. Usually a redirect-URI mismatch in the Meta app settings. |
| `pages_failed` | `GET /me/accounts` failed. Usually a missing `pages_show_list` scope or a non-Page-enabled test account. |
| `no_pages` | Your Facebook account manages no Pages. Create one (even an empty Page is enough). |

### 8.5 Token refresh cron (local)

The refresh cron is the same shape as the publish-due cron, secured by the `CRON_SECRET` header.

```bash
# positive: returns { "refreshed": 0, "markedReconnect": 0 } when nothing is due
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/refresh-tokens

# negative: missing header → 401
curl -X POST http://localhost:3000/api/cron/refresh-tokens

# negative: wrong secret → 401
curl -X POST -H "x-cron-secret: WRONG" http://localhost:3000/api/cron/refresh-tokens
```

To exercise the **refresh** path locally: set an existing `SocialAccount`'s `tokenExpiresAt` to less than 7 days in the future and re-run the cron. The route decrypts the long-lived user token, calls `refreshUserToken`, re-encrypts the new token, and updates `tokenExpiresAt`. You can verify with:

```sql
-- pnpm prisma studio, or psql
SELECT id, platform, handle, status, "tokenExpiresAt"
FROM "SocialAccount"
WHERE "refreshTokenEncrypted" IS NOT NULL;
```

### 8.6 `RECONNECT_REQUIRED` path

Two ways to verify this unhappy path locally:

1. **Revoke the token in Meta.** Go to <https://www.facebook.com/settings?tab=applications> → your OmniPost app → Remove. Back in OmniPost, publish a post targeting that FB account. `checkAuth` then the publish call returns `authExpired: true`; the publisher marks the `PostTarget` `FAILED` with the CTA message and flips `SocialAccount.status` to `RECONNECT_REQUIRED`. The account row in `/settings/accounts` now shows the amber "Reconnect required" pill, and the composer disables it for selection.
2. **Corrupt the encrypted token.** Pick a real-FB row in `pnpm prisma studio` and append garbage to its `accessToken` (e.g. `...XX`). Publishing that target returns `authExpired: true, retryable: false`; the account flips to `RECONNECT_REQUIRED` without ever calling the Graph API. Reconnecting through the **Reconnect** button re-runs OAuth and overwrites the bad value, restoring `ACTIVE` status.

### 8.7 Token encryption at rest (verification)

The crypto unit suite already covers round trips, but to verify at-rest encryption end-to-end:

1. Complete the live connect flow (§8.4) so a real-FB `SocialAccount` row exists.
2. `pnpm prisma studio` → open the `SocialAccount` table → the `accessToken` and `refreshTokenEncrypted` columns are base64 blobs that **do not contain** the plaintext Page/user token. You should not be able to read `EAA…` in them.
3. Drop `APP_ENCRYPTION_KEY` from `.env`, restart `pnpm dev`, attempt to publish. You'll get `EncryptionConfigError` logged on the server and the target marked `FAILED` ("Reconnect your Facebook account…") — confirming the persisted tokens are useless without the key.

## Why Instagram publish is deferred

Instagram's Graph API requires **every post to include a publicly-fetchable image URL**. Meta's servers fetch that URL; it cannot be local-only (so your browser can reach `localhost:3000/api/uploads/x.jpg`, but Meta's crawler cannot).

OmniPost's current `MediaStorage` implementation is local disk (`src/lib/storage/local.ts`). Phase 2a deliberately does not introduce a new dependency to the locked tech stack. Once an S3-compatible / Vercel Blob / Cloudflare R2 `MediaStorage` implementation lands, the `RealInstagramAdapter` will arrive in the same shape as `RealFacebookAdapter`:

- `publishPost` will `POST /{ig-bus-acct-id}/media` with `image_url=<public URL>` then `POST /{ig-bus-acct-id}/media_publish` once the container is ready.
- `checkAuth` will `GET /{ig-bus-acct-id}?fields=username`.
- `fetchAnalytics` will hit `/{ig-bus-acct-id}/insights`.

Until then, Instagram's `publishPost` keeps returning the mock URL `https://mock.instagram.local/post/...` even after a real OAuth connect — by design.

## Architectural notes

- **Per-platform dispatch.** `src/lib/platforms/registry.ts` resolves a platform's adapter at call time from `REAL_FACEBOOK` / `REAL_INSTAGRAM` env flags; other platforms ignore the flags. This replaces the global `MOCK_PLATFORMS` flag, so rolling out real FB doesn't disable mocks for X / TikTok / LinkedIn.
- **Token storage.** `SocialAccount.accessToken` holds the **encrypted** Page access token; `refreshTokenEncrypted` holds the long-lived user token (refreshable); `tokenExpiresAt` is the user-token expiry; `externalAccountId` is the Page ID (or IG business-account ID). The whole key envelope is `iv ‖ ciphertext ‖ authTag` — see `src/lib/crypto.ts`.
- **CSRF + PKCE.** `state` is HMAC-signed (`AUTH_SECRET` as the key) and round-tripped via an HttpOnly cookie; PKCE uses S256. A mismatched state, missing cookie, or replayed finalize payload is rejected — see `src/lib/platforms/oauth/meta.ts`.
- **Error sanitization.** On any non-200 Graph response, `RealFacebookAdapter` sanitizes the message before returning from `publishPost`; the raw Meta error body never reaches the UI or the persisted `PostTarget.error`.
- **Idempotency is unchanged.** The atomic `SCHEDULED → PUBLISHING` claim in `queue/publisher.ts` is still the only place that prevents duplicate publishes. The real adapter does **not** dedupe — a repeated `publishPost` with the same target *would* produce two platform posts, which is why the publisher's atomic claim must stay intact; do not move that gate into adapters.

## Future phases (out of scope for 2a)

- Real Instagram publishing (once MediaStorage supports public URLs).
- Real LinkedIn / X / TikTok adapters (same shape as FB).
- Webhook-based analytics sync (instead of the manual refresh button).
- Page-list caching across sessions (currently per-OAuth-flow only).