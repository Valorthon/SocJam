# OmniPost — Stitch Design Prompt (Linear + Typefully references)

> Paste everything below the line into Google Stitch. Attach two reference images:
> **Image 1 = Linear** (app.linear.app screenshots — dark dashboard, settings, any list view).
> **Image 2 = Typefully** (typefully.com composer screenshot).

---

Design a web app called **OmniPost** — a centralized social media management hub for social media managers and marketing teams. Users write one post, let AI adapt it for each platform (X/Twitter, Facebook, Instagram, TikTok, LinkedIn), then publish or schedule it to all platforms at once and track per-platform results in one dashboard. Tagline: "Write once. Publish everywhere."

## ATTACHED REFERENCES

- **Image 1 (Linear):** Overall visual language. Match THIS for everything — dark surface hierarchy, border-only panels (no shadows), typography discipline, muted status colors, density, restraint.
- **Image 2 (Typefully):** Layout reference for the COMPOSE SCREEN ONLY — writing-first layout, platform selection up top, minimal chrome around the editor. Do NOT copy its light theme or its branding.

Where the references conflict: Image 1 wins for style, Image 2 wins for composer layout. Everything not covered by a reference defaults to Image 1's language.

## VISUAL LANGUAGE

- **Dark-first UI.** Background #0A0A0B, raised surfaces #101012, 1px borders #1F1F23. Absolutely no drop shadows, no glows, no glassmorphism.
- **Corner radius: 8px maximum.** No pill-shaped cards (status pills and small chips may be rounded-full).
- **Typography:** Inter for UI text with tight letter-spacing (-0.01em on headings). A monospace font (JetBrains Mono or Geist Mono) for ALL data: numbers, character counters, timestamps, handles, URLs. This mono-for-data rule is a signature of the design — apply it everywhere.
- **Color discipline:** The UI is essentially monochrome (white/gray on near-black). Primary action buttons are WHITE (light surface, dark text), exactly like Linear's primary buttons. Color appears only in two places: (a) muted status colors — green #4ADE80 published, blue #60A5FA scheduled, amber #FBBF24 warnings/publishing, red #F87171 failed, orange #FB923C partial failure — always desaturated, used in small dots and thin badges, never as large fills; (b) platform brand colors as tiny 6–8px dots next to platform names only: X = white, Facebook = #1877F2, Instagram = #E1306C, TikTok = #25F4EE, LinkedIn = #0A66C2. Never use platform colors as backgrounds or fills.
- **AI elements:** understated. A small mono uppercase "AI" tag on AI-generated content. No sparkle icons, no gradients, no glow.
- **BANNED:** purple or blue gradients, indigo/violet primaries, glassmorphism, drop shadows, 3D illustrations, stock photos, emoji in UI, sparkle icons, heavy chart decorations, rounded-2xl cards.
- Fully responsive, mobile-first: every screen must work at 375px width. Style must translate cleanly to Tailwind CSS + shadcn/ui components.

## APP SHELL

- **Left sidebar** (collapses to a bottom nav bar on mobile): wordmark "OmniPost" in Inter 600, nav items with minimal outline icons — Dashboard, Calendar, Analytics, Settings — plus **Compose** rendered as a prominent white primary button at the top of the nav (like Linear's "New issue" button). Active nav item: subtle #1F1F23 background fill, no colored indicators.
- **Top bar:** page title (Inter 500, 15px), right side: user's timezone in mono gray text, avatar menu. Thin 1px bottom border. No breadcrumbs, no search bar.
- Content area: max-width ~1100px, generous padding, single-column flows.

## SCREENS

### 1. LOGIN / SIGNUP
Linear-style auth: centered narrow card (360px) on the bare #0A0A0B background, no illustration. Wordmark + tagline above the card. Email + password inputs (dark, 1px border, 8px radius), white primary submit button, divider "or", "Continue with Google" secondary button (dark, bordered). Small "Forgot password?" link (renders a simple "Coming soon" modal on click). Text link to toggle between Sign in / Create account. Error state: red mono text below the form, e.g. "Invalid email or password."

### 2. ONBOARDING EMPTY STATE (first run)
Centered in the content area: mono gray uppercase label "GETTING STARTED", heading "Connect your first account", one line of gray helper text. Below: the 5 platform cards in a row (stack on mobile) — platform dot, platform name, short gray descriptor (e.g. "Text posts, 280 chars"), dark bordered "Connect" button. No illustrations, no confetti.

### 3. DASHBOARD (post history)
Linear list-view aesthetic. Top: filter tabs as subtle text buttons (All / Published / Scheduled / Failed) with mono counts next to each. Below: a flat list, rows separated by 1px borders (NOT cards). Each row: status dot, post excerpt (1 line, truncated), small platform dots for its targets, status badge (small, thin border, muted color, mono uppercase 11px text: PUBLISHED / PARTIALLY FAILED / FAILED / SCHEDULED), date in mono gray. Rows hover to #101012. Failed rows show a tiny "Retry" text-button on the right. Empty state: centered mono gray line "No posts yet — write once, publish everywhere." with a white "New post" button.

### 4. POST DETAIL
Top: a thin status summary banner (1px border, no fill) — mono uppercase text: "PUBLISHED TO 3 OF 5 PLATFORMS" with the 5 platform dots lit or dimmed accordingly. Below, two-column layout on desktop (stacked on mobile):
- Left column: the base post — full text, media thumbnails (8px radius, 1px border), scheduled/published timestamps in mono.
- Right column: "Platforms" — one row per target: platform dot + platform name + handle (mono gray), status badge, and on the right: published URL (mono, truncated, external-link icon) when live, or red mono error text + "Retry" text-button when failed, or "Queued"/"Scheduled for {mono timestamp}" when pending.
If the post is SCHEDULED: show "Edit", "Reschedule", and "Cancel" text-buttons in the top right of the detail area.

### 5. COMPOSE (core screen — follow Image 2's layout philosophy: writing first, minimal chrome)
- **Platform selector at the very top:** a row of toggle chips, one per connected account (platform dot + handle in mono). Selected = subtle filled state with a 1px white/20 border. An account needing reconnection is dimmed with an amber dot and shows tooltip "Reconnect required."
- **Editor:** one large borderless-feeling textarea dominating the upper area, placeholder "What do you want to share?" — generous type (16px), no visible box until focused. Live character count in mono gray, bottom-right of the editor.
- **Media:** a dashed-border dropzone row below the editor ("Drop images or video"), with thumbnail previews (remove × on hover).
- **AI row:** a dark bordered "Adapt with AI" button with a small mono "AI" tag, next to a minimal tone dropdown (Professional / Casual / Playful / Bold).
- **Variant cards:** after AI adaptation (or when the user expands a platform), a 2-column grid (stacked on mobile) of platform cards. Each card: header row (platform dot, platform name, mono char counter "42/280" — counter turns red #F87171 when over limit), editable textarea pre-filled with that platform's version, footer row: validation line in mono 12px (green "✓ image attached" or red "✗ Instagram requires an image" / red "✗ over limit by 42"), a small mono "AI" tag if AI-generated, and a regenerate icon-button (circular arrows, outline only).
- **AI loading state:** variant cards render as shimmer skeletons (subtle, gray, no color).
- **Sticky bottom bar** (1px top border, background #0A0A0B): right-aligned — "Schedule" dark secondary button (opens a date+time picker popover labeled with the user's timezone in mono, quick presets "In 1 hour" / "Tomorrow 9:00") and white primary "Publish now" button. Both disabled (40% opacity) until every selected platform's card is valid; disabled reason shown as small gray helper text ("Select at least one platform" / "2 platforms have errors").

### 6. CALENDAR
Notion-Calendar-like restraint, in Linear's dark language. Header: month label (Inter 500), Week/Month toggle as two small text buttons, "Today" text-button. Month grid: 1px hairline lines, day numbers in mono gray, today's number highlighted with a subtle filled circle. Scheduled posts appear as slim chips inside day cells: mono time + platform dots (max 3, then "+2"). Click a chip → post detail. Right side panel (collapses below the calendar on mobile): "UPCOMING" mono label, chronological list — each item: mono date/time, post excerpt, platform dots, status badge.

### 7. ANALYTICS
Top: 5 stat blocks in a row (2-col grid on mobile) — mono 28px numbers, small gray uppercase labels: POSTS THIS MONTH / PUBLISHED / SCHEDULED / FAILED / PARTIAL FAILURES. No trend arrows, no colored backgrounds, no chart junk.
Below: "PER-PLATFORM METRICS" mono section label, then a flat table (1px row borders): post excerpt, platform dot + name, and mono right-aligned columns IMPRESSIONS / LIKES / COMMENTS / SHARES, then "last synced 14:32" in mono gray 12px. Header row: gray uppercase mono 11px labels. Right above the table: "Refresh metrics" dark bordered text-button (when rate-limited, dimmed with mono note "next refresh in 4:12"). States to include: a row with an amber mono "STALE" tag next to its timestamp; a row reading "Not published yet" in gray italic across the metric columns.

### 8. SETTINGS → CONNECTED ACCOUNTS
Page title "Connected accounts", gray helper line "Connect the platforms you publish to." A flat list (1px row borders, not cards) of the 5 platforms. Each row: platform dot, platform name, and either —
- **Disconnected state:** gray "Not connected" + right-aligned dark bordered "Connect" button; or
- **Connected state:** avatar placeholder circle, @handle in mono, status badge (green-dot "CONNECTED" or amber-dot "RECONNECT REQUIRED"), and a red-tinged "Disconnect" text-button.
Also design the **connect modal**: a centered dialog (dark, 1px border, 8px radius) styled like a minimal OAuth consent screen — platform dot + "Authorize OmniPost to post as", a handle input (mono, "@" prefix), "Authorize" white primary button, "Cancel" text-button. Include the disconnect-confirmation variant: "This account has 3 scheduled posts. Disconnecting will cancel them." with "Cancel" / "Disconnect anyway" (red).

## STATES & POLISH

For every screen include: loading skeletons (gray shimmer, never spinners alone), empty states (single mono gray line + one action, no illustrations), and error surfaces (red mono text or a top-right dark toast with 1px red-tinted border). Interactive elements get subtle hover states (#1F1F23 fills). Nothing bounces, nothing slides — state changes are instant or a fast 150ms fade.
