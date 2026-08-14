# UI Reference — Google Stitch Designs

This file contains the original HTML/CSS produced by Google Stitch for the six OmniPost screens. It is **reference only** — the real implementation uses Next.js 14, React, TypeScript, shadcn/ui, and Tailwind CSS.

## App Name

The original Stitch output used the working title **OmniPost**. The project name is **OmniPost**. All labels, headings, and metadata in the implementation should use OmniPost.

## Screens

1. **Sign In**
2. **Onboarding** (Connect first account)
3. **Dashboard** (Post history)
4. **Analytics**
5. **Compose**
6. **Settings → Connected Accounts**

## Design Notes

- Always dark mode (`#0A0A0B` page background, `#101012` surfaces, `#1F1F23` borders).
- Inter for body/headlines; Geist Mono for labels/data.
- Use lucide-react for icons instead of Material Symbols.
- Rounded tokens: `0.25rem` default, `0.5rem` lg.
- Layout conventions: 240 px fixed desktop sidebar, 56 px topbar.
- Mobile-first responsive pass comes after the desktop layout is complete.

## Stitch-to-Component Mapping

| Stitch Element | OmniPost Component |
|---|---|
| Auth card | `src/app/(auth)/login/page.tsx` + `src/app/(auth)/signup/page.tsx` |
| Platform rows | `src/components/features/accounts/AccountCard.tsx` |
| Connect button + consent dialog | `src/components/features/accounts/ConnectAccountButton.tsx` + `MockConsentDialog.tsx` |
| Sidebar nav | `src/components/features/shell/AppSidebar.tsx` |
| Topbar | `src/components/features/shell/TopNav.tsx` |
| Post history table | `src/components/features/posts/PostHistoryTable.tsx` |
| Status dot + badge | `src/components/features/posts/PostStatusBadge.tsx` |
| Platform color dots | `src/components/features/posts/PlatformDotGroup.tsx` |
| Metrics cards | `src/components/features/analytics/MetricsCard.tsx` |
| Metrics table | `src/components/features/analytics/PostMetricsTable.tsx` |
| Composer textarea | `src/components/features/composer/BaseTextArea.tsx` |
| Platform selector chips | `src/components/features/composer/PlatformSelector.tsx` |
| Variant cards | `src/components/features/composer/PlatformVariantCard.tsx` |
| AI Adapt button | `src/components/features/composer/AiAdaptPanel.tsx` |
| Media toolbar | `src/components/features/composer/MediaUploader.tsx` |
| Sticky publish footer | `src/components/features/composer/PublishFooter.tsx` |

## Original Stitch Code

The full HTML from each Stitch screen is included below for layout reference only. It should **not** be copied as-is into the application.

---

### 1. Sign In

```html
<!-- OmniPost — Sign In -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>OmniPost - Login</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-tertiary-fixed-variant": "#454747",
                      "surface-container-highest": "#353434",
                      "surface-container": "#201f1f",
                      "primary-fixed-dim": "#c6c6c7",
                      "surface-variant": "#353434",
                      "on-secondary-fixed": "#1b1b1f",
                      "on-tertiary-container": "#636565",
                      "outline": "#8e9192",
                      "surface-tint": "#c6c6c7",
                      "on-secondary-container": "#b6b4b9",
                      "secondary-fixed": "#e4e1e7",
                      "primary-fixed": "#e2e2e2",
                      "primary": "#ffffff",
                      "secondary-fixed-dim": "#c8c5cb",
                      "on-primary-fixed-variant": "#454747",
                      "secondary-container": "#47464b",
                      "tertiary-fixed": "#e2e2e2",
                      "background": "#141313",
                      "inverse-on-surface": "#313030",
                      "surface-container-high": "#2a2a2a",
                      "inverse-primary": "#5d5f5f",
                      "on-tertiary-fixed": "#1a1c1c",
                      "on-tertiary": "#2f3131",
                      "on-error-container": "#ffdad6",
                      "inverse-surface": "#e5e2e1",
                      "on-surface": "#e5e2e1",
                      "outline-variant": "#444748",
                      "surface": "#141313",
                      "secondary": "#c8c5cb",
                      "surface-bright": "#3a3939",
                      "on-background": "#e5e2e1",
                      "on-primary": "#2f3131",
                      "on-secondary": "#303034",
                      "error-container": "#93000a",
                      "on-secondary-fixed-variant": "#47464b",
                      "surface-dim": "#141313",
                      "tertiary-container": "#e2e2e2",
                      "error": "#ffb4ab",
                      "on-error": "#690005",
                      "tertiary": "#ffffff",
                      "tertiary-fixed-dim": "#c6c6c7",
                      "primary-container": "#e2e2e2",
                      "surface-container-low": "#1c1b1b",
                      "on-surface-variant": "#c4c7c8",
                      "on-primary-fixed": "#1a1c1c",
                      "on-primary-container": "#636565",
                      "surface-container-lowest": "#0e0e0e"
              },
              "borderRadius": {
                      "DEFAULT": "0.25rem",
                      "lg": "0.5rem",
                      "xl": "0.75rem",
                      "full": "9999px"
              },
              "spacing": {
                      "margin-mobile": "16px",
                      "panel-padding": "20px",
                      "unit": "4px",
                      "gutter": "16px",
                      "margin-desktop": "24px"
              },
              "fontFamily": {
                      "body-sm": ["Inter"],
                      "mono-data": ["Geist Mono"],
                      "headline-md": ["Inter"],
                      "body-base": ["Inter"],
                      "headline-lg": ["Inter"],
                      "mono-label": ["Geist Mono"]
              },
              "fontSize": {
                      "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                      "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                      "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                      "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                      "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                      "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
              }
            },
          },
        }
    </script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body { background-color: #0A0A0B; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center text-on-surface font-body-base bg-[#0A0A0B] p-margin-mobile md:p-margin-desktop">
<div class="w-full max-w-[360px] flex flex-col gap-[32px]">
<!-- Header -->
<div class="flex flex-col items-center text-center gap-unit">
<h1 class="font-headline-lg text-headline-lg text-primary tracking-tighter">OmniPost</h1>
<p class="font-body-base text-body-base text-on-surface-variant">Write once. Publish everywhere.</p>
</div>
<!-- Form Card -->
<div class="bg-surface-container-low border border-outline-variant rounded-lg p-[24px] flex flex-col gap-[24px]">
<form class="flex flex-col gap-[16px]">
<div class="flex flex-col gap-[8px]">
<label class="font-mono-label text-mono-label text-on-surface-variant" for="email">Email</label>
<input class="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg px-[12px] py-[10px] font-body-base text-body-base text-on-surface focus:outline-none focus:border-outline-variant focus:ring-1 focus:ring-outline-variant placeholder-on-surface-variant/50 transition-colors" id="email" name="email" placeholder="you@example.com" type="email"/>
</div>
<div class="flex flex-col gap-[8px]">
<div class="flex justify-between items-center">
<label class="font-mono-label text-mono-label text-on-surface-variant" for="password">Password</label>
<a class="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Forgot?</a>
</div>
<input class="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg px-[12px] py-[10px] font-body-base text-body-base text-on-surface focus:outline-none focus:border-outline-variant focus:ring-1 focus:ring-outline-variant placeholder-on-surface-variant/50 transition-colors" id="password" name="password" placeholder="••••••••" type="password"/>
</div>
<!-- Error Message -->
<div class="font-mono-data text-mono-data text-error mt-unit">
                    Invalid email or password.
                </div>
<button class="w-full bg-primary text-on-primary font-body-base text-body-base font-medium rounded p-[10px] hover:bg-primary/90 transition-colors mt-[8px]" type="submit">
                    Sign In
                </button>
</form>
<div class="flex items-center gap-[12px] w-full">
<div class="h-px bg-outline-variant flex-1"></div>
<span class="font-mono-label text-mono-label text-on-surface-variant uppercase">Or</span>
<div class="h-px bg-outline-variant flex-1"></div>
</div>
<button class="w-full bg-transparent border border-[#1F1F23] text-primary font-body-base text-body-base font-medium rounded-lg p-[10px] hover:bg-surface-container transition-colors flex items-center justify-center gap-[8px]" type="button">
<svg class="w-[18px] h-[18px]" fill="currentColor" viewbox="0 0 24 24">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
</svg>
                Continue with Google
            </button>
</div>
<!-- Footer Links -->
<div class="flex justify-center gap-[16px] font-body-sm text-body-sm text-on-surface-variant">
<a class="hover:text-primary transition-colors" href="#">Sign up</a>
<span class="text-outline-variant">•</span>
<a class="hover:text-primary transition-colors" href="#">Privacy</a>
<span class="text-outline-variant">•</span>
<a class="hover:text-primary transition-colors" href="#">Terms</a>
</div>
</div>
</body>
</html>
```

---

### 2. Onboarding

```html
<!-- Design System -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>OmniPost - Onboarding</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary-fixed-variant": "#454747",
                        "surface-container-highest": "#353434",
                        "surface-container": "#201f1f",
                        "primary-fixed-dim": "#c6c6c7",
                        "surface-variant": "#353434",
                        "on-secondary-fixed": "#1b1b1f",
                        "on-tertiary-container": "#636565",
                        "outline": "#8e9192",
                        "surface-tint": "#c6c6c7",
                        "on-secondary-container": "#b6b4b9",
                        "secondary-fixed": "#e4e1e7",
                        "primary-fixed": "#e2e2e2",
                        "primary": "#ffffff",
                        "secondary-fixed-dim": "#c8c5cb",
                        "on-primary-fixed-variant": "#454747",
                        "secondary-container": "#47464b",
                        "tertiary-fixed": "#e2e2e2",
                        "background": "#141313",
                        "inverse-on-surface": "#313030",
                        "surface-container-high": "#2a2a2a",
                        "inverse-primary": "#5d5f5f",
                        "on-tertiary-fixed": "#1a1c1c",
                        "on-tertiary": "#2f3131",
                        "on-error-container": "#ffdad6",
                        "inverse-surface": "#e5e2e1",
                        "on-surface": "#e5e2e1",
                        "outline-variant": "#444748",
                        "surface": "#141313",
                        "secondary": "#c8c5cb",
                        "surface-bright": "#3a3939",
                        "on-background": "#e5e2e1",
                        "on-primary": "#2f3131",
                        "on-secondary": "#303034",
                        "error-container": "#93000a",
                        "on-secondary-fixed-variant": "#47464b",
                        "surface-dim": "#141313",
                        "tertiary-container": "#e2e2e2",
                        "error": "#ffb4ab",
                        "on-error": "#690005",
                        "tertiary": "#ffffff",
                        "tertiary-fixed-dim": "#c6c6c7",
                        "primary-container": "#e2e2e2",
                        "surface-container-low": "#1c1b1b",
                        "on-surface-variant": "#c4c7c8",
                        "on-primary-fixed": "#1a1c1c",
                        "on-primary-container": "#636565",
                        "surface-container-lowest": "#0e0e0e"
                    },
                    borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
                    spacing: { "margin-mobile": "16px", "panel-padding": "20px", "unit": "4px", "gutter": "16px", "margin-desktop": "24px" },
                    fontFamily: { "body-sm": ["Inter"], "mono-data": ["Geist Mono"], "headline-md": ["Inter"], "body-base": ["Inter"], "headline-lg": ["Inter"], "mono-label": ["Geist Mono"] },
                    fontSize: {
                        "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                        "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                        "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                        "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                        "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                        "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
                    }
                }
            }
        }
    </script>
<style>
        body { background-color: #0A0A0B; color: #ffffff; }
    </style>
</head>
<body class="antialiased min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-desktop">
<!-- Onboarding Canvas -->
<main class="w-full max-w-2xl flex flex-col items-center">
<div class="text-center mb-12 flex flex-col items-center gap-4">
<span class="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">GETTING STARTED</span>
<h1 class="font-headline-lg text-headline-lg text-primary">Connect your first account</h1>
</div>
<div class="w-full bg-[#101012] border border-[#1F1F23] rounded p-6 flex flex-col gap-4">
<!-- Platform: X -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-[6px] h-[6px] rounded-full bg-[#ffffff]"></div>
<div class="flex flex-col">
<span class="font-body-base text-body-base text-primary">X (Twitter)</span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Text posts, 280 chars</span>
</div>
</div>
<button class="font-body-sm text-body-sm bg-transparent border border-[#1F1F23] text-primary px-4 py-2 rounded hover:bg-[#1F1F23] transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    Connect
                </button>
</div>
<!-- Platform: Facebook -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-[6px] h-[6px] rounded-full bg-[#1877F2]"></div>
<div class="flex flex-col">
<span class="font-body-base text-body-base text-primary">Facebook</span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Pages &amp; Groups</span>
</div>
</div>
<button class="font-body-sm text-body-sm bg-transparent border border-[#1F1F23] text-primary px-4 py-2 rounded hover:bg-[#1F1F23] transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    Connect
                </button>
</div>
<!-- Platform: Instagram -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-[6px] h-[6px] rounded-full bg-[#E1306C]"></div>
<div class="flex flex-col">
<span class="font-body-base text-body-base text-primary">Instagram</span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Reels &amp; Carousels</span>
</div>
</div>
<button class="font-body-sm text-body-sm bg-transparent border border-[#1F1F23] text-primary px-4 py-2 rounded hover:bg-[#1F1F23] transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    Connect
                </button>
</div>
<!-- Platform: TikTok -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-[6px] h-[6px] rounded-full bg-[#25F4EE]"></div>
<div class="flex flex-col">
<span class="font-body-base text-body-base text-primary">TikTok</span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Short-form video</span>
</div>
</div>
<button class="font-body-sm text-body-sm bg-transparent border border-[#1F1F23] text-primary px-4 py-2 rounded hover:bg-[#1F1F23] transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    Connect
                </button>
</div>
<!-- Platform: LinkedIn -->
<div class="flex items-center justify-between p-4 hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-[6px] h-[6px] rounded-full bg-[#0A66C2]"></div>
<div class="flex flex-col">
<span class="font-body-base text-body-base text-primary">LinkedIn</span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Professional network</span>
</div>
</div>
<button class="font-body-sm text-body-sm bg-transparent border border-[#1F1F23] text-primary px-4 py-2 rounded hover:bg-[#1F1F23] transition-colors focus:outline-none focus:ring-1 focus:ring-primary">
                    Connect
                </button>
</div>
</div>
</main>
</body>
</html>
```

---

### 3. Dashboard (Post History)

```html
<!-- OmniPost — Get Started -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Dashboard - Post History</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-tertiary-fixed-variant": "#454747",
                        "surface-container-highest": "#353434",
                        "surface-container": "#201f1f",
                        "primary-fixed-dim": "#c6c6c7",
                        "surface-variant": "#353434",
                        "on-secondary-fixed": "#1b1b1f",
                        "on-tertiary-container": "#636565",
                        "outline": "#8e9192",
                        "surface-tint": "#c6c6c7",
                        "on-secondary-container": "#b6b4b9",
                        "secondary-fixed": "#e4e1e7",
                        "primary-fixed": "#e2e2e2",
                        "primary": "#ffffff",
                        "secondary-fixed-dim": "#c8c5cb",
                        "on-primary-fixed-variant": "#454747",
                        "secondary-container": "#47464b",
                        "tertiary-fixed": "#e2e2e2",
                        "background": "#141313",
                        "inverse-on-surface": "#313030",
                        "surface-container-high": "#2a2a2a",
                        "inverse-primary": "#5d5f5f",
                        "on-tertiary-fixed": "#1a1c1c",
                        "on-tertiary": "#2f3131",
                        "on-error-container": "#ffdad6",
                        "inverse-surface": "#e5e2e1",
                        "on-surface": "#e5e2e1",
                        "outline-variant": "#444748",
                        "surface": "#141313",
                        "secondary": "#c8c5cb",
                        "surface-bright": "#3a3939",
                        "on-background": "#e5e2e1",
                        "on-primary": "#2f3131",
                        "on-secondary": "#303034",
                        "error-container": "#93000a",
                        "on-secondary-fixed-variant": "#47464b",
                        "surface-dim": "#141313",
                        "tertiary-container": "#e2e2e2",
                        "error": "#ffb4ab",
                        "on-error": "#690005",
                        "tertiary": "#ffffff",
                        "tertiary-fixed-dim": "#c6c6c7",
                        "primary-container": "#e2e2e2",
                        "surface-container-low": "#1c1b1b",
                        "on-surface-variant": "#c4c7c8",
                        "on-primary-fixed": "#1a1c1c",
                        "on-primary-container": "#636565",
                        "surface-container-lowest": "#0e0e0e"
                    },
                    "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
                    "spacing": { "margin-mobile": "16px", "panel-padding": "20px", "unit": "4px", "gutter": "16px", "margin-desktop": "24px" },
                    "fontFamily": { "body-sm": ["Inter"], "mono-data": ["Geist Mono"], "headline-md": ["Inter"], "body-base": ["Inter"], "headline-lg": ["Inter"], "mono-label": ["Geist Mono"] },
                    "fontSize": {
                        "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                        "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                        "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                        "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                        "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                        "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
                    }
                }
            }
        }
    </script>
<style>
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #353434; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #444748; }
    </style>
</head>
<body class="bg-background text-on-background font-body-base h-screen overflow-hidden flex flex-col md:flex-row">
<!-- SideNavBar (Desktop) -->
<nav class="hidden md:flex flex-col h-full py-panel-padding bg-surface-container-low dark:bg-surface-container-low fixed left-0 top-0 h-full w-[240px] border-r border-outline-variant dark:border-outline-variant z-20">
<div class="px-margin-desktop mb-8 flex items-center gap-3">
<div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold overflow-hidden">
<img alt="User Avatar" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPBtqddQXGBw8uWsW0on4rWB9zTy0vLbhpzl0XX1gm0MMm2UTB-BnmTobjMLQoixRwbxSVO8uKw0rSj21cGr9rrjEeTqd4ah9sM3z2QfF38arcwvOxn6kfawFglIB8NQcPnzZk0omD-MY8MbxHTIIaKICRlgRJFHPjkv_tk514jjB548vNbqWvm0ryLsE1T4q_8omCDAM3f1YBGLzMZgzqsAlsl6SQQEFSZFqoVC9e3mkNNqwUaR4rLQ"/>
</div>
<div>
<div class="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary tracking-tighter">OmniPost</div>
<div class="font-mono-label text-mono-label text-on-surface-variant">Management Console</div>
</div>
</div>
<div class="flex-1 flex flex-col gap-2">
<!-- Active Nav Item -->
<a class="flex items-center gap-3 text-primary dark:text-primary border-l-2 border-primary py-2 px-4 bg-surface-container dark:bg-surface-container scale-[0.98] transition-transform" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">dashboard</span>
<span class="font-body-sm text-body-sm">Dashboard</span>
</a>
<!-- Inactive Nav Items -->
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined">calendar_today</span>
<span class="font-body-sm text-body-sm">Calendar</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined">insights</span>
<span class="font-body-sm text-body-sm">Analytics</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined">settings</span>
<span class="font-body-sm text-body-sm">Settings</span>
</a>
</div>
<div class="px-4 mt-auto">
<button class="w-full bg-primary text-on-primary font-body-sm text-body-sm font-semibold py-2 rounded flex items-center justify-center gap-2 hover:bg-primary-fixed-dim transition-colors">
<span class="material-symbols-outlined text-[18px]">edit</span>
                Compose
            </button>
</div>
</nav>
<!-- Main Content Area -->
<div class="flex-1 flex flex-col h-full w-full md:ml-[240px]">
<!-- TopNavBar -->
<header class="flex justify-between items-center px-margin-desktop w-full h-14 bg-background dark:bg-background border-b border-outline-variant dark:border-outline-variant z-10 shrink-0">
<div class="flex items-center gap-2">
<h1 class="font-headline-md text-headline-md text-primary dark:text-primary">Dashboard</h1>
</div>
<div class="flex items-center gap-4">
<div class="hidden md:flex font-mono-data text-mono-data text-on-surface-variant">
                    UTC-05:00
                </div>
<button class="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant hover:opacity-80 transition-opacity">
<img alt="User Profile" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYXgz7KNj3-01j3gfA84OqcZmTpWoGHDncwwCx82OOPmD0QQyu2ptgKOoK2IQPiclzD_aZoStsg5BDAyXoSt3KC_RNqTnxY8vfwqhtpSnEFtXcje40SJHvMmOqxZ_1a-MBkN5imzuhiYbkwKNPp-rF_H7wIZ9L7FDvNUJDJgZ0MG6st89yDSD-7dDd005IJV9gXGvyPZEWxaEuX_XkDooKOFugvOT88sJVp_lbSWbpC11BfpflGm4LEA"/>
</button>
</div>
</header>
<!-- Main Canvas -->
<main class="flex-1 overflow-y-auto bg-background p-margin-mobile md:p-margin-desktop relative">
<!-- Filters & Controls -->
<div class="mb-gutter flex flex-wrap gap-4 items-center justify-between">
<div class="flex gap-2 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
<button class="px-3 py-1.5 bg-surface-container-high text-primary rounded font-body-sm text-body-sm font-medium transition-colors">
                        All <span class="font-mono-data text-mono-data text-on-surface-variant ml-1">124</span>
</button>
<button class="px-3 py-1.5 text-on-surface-variant hover:text-primary rounded font-body-sm text-body-sm transition-colors">
                        Published <span class="font-mono-data text-mono-data opacity-60 ml-1">98</span>
</button>
<button class="px-3 py-1.5 text-on-surface-variant hover:text-primary rounded font-body-sm text-body-sm transition-colors">
                        Scheduled <span class="font-mono-data text-mono-data opacity-60 ml-1">21</span>
</button>
<button class="px-3 py-1.5 text-on-surface-variant hover:text-error rounded font-body-sm text-body-sm transition-colors">
                        Failed <span class="font-mono-data text-mono-data opacity-60 ml-1">5</span>
</button>
</div>
<div class="flex gap-2">
<button class="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-body-sm text-body-sm">
<span class="material-symbols-outlined text-[18px]">filter_list</span>
                        Filter
                    </button>
</div>
</div>
<!-- List View -->
<div class="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
<!-- Header Row -->
<div class="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-outline-variant bg-surface-container-lowest font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">
<div class="w-2"></div>
<div>Post Content</div>
<div class="w-24 text-center">Platforms</div>
<div class="w-24 text-center">Status</div>
<div class="w-32 text-right">Date</div>
</div>
<!-- Row 1: Published -->
<div class="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 md:gap-4 px-4 py-4 border-b border-outline-variant hover:bg-surface-container-high transition-colors group cursor-pointer items-center relative">
<div class="w-2 h-2 rounded-full bg-[#10b981] mt-1.5 md:mt-0"></div>
<div class="font-body-base text-body-base text-on-surface truncate pr-4">
                        Excited to announce our new feature drop! 🚀 We've completely re-engineered the...
                    </div>
<div class="hidden md:flex justify-center gap-1">
<div class="w-1.5 h-1.5 rounded-full bg-[#1da1f2]" title="Twitter"></div>
<div class="w-1.5 h-1.5 rounded-full bg-[#0a66c2]" title="LinkedIn"></div>
</div>
<div class="hidden md:flex justify-center">
<span class="font-mono-label text-mono-label text-on-surface-variant bg-surface-container-lowest border border-outline-variant px-2 py-0.5 rounded">PUBLISHED</span>
</div>
<div class="font-mono-data text-mono-data text-on-surface-variant text-right col-start-2 md:col-start-auto">
                        Oct 24, 09:15 AM
                    </div>
</div>
<!-- Row 2: Failed -->
<div class="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 md:gap-4 px-4 py-4 border-b border-outline-variant bg-[#2c1414]/30 hover:bg-[#2c1414]/60 transition-colors group items-center relative">
<div class="w-2 h-2 rounded-full bg-error mt-1.5 md:mt-0"></div>
<div class="font-body-base text-body-base text-on-surface truncate pr-4">
                        A quick look at Q3 metrics and what we learned about engagement rates across...
                    </div>
<div class="hidden md:flex justify-center gap-1">
<div class="w-1.5 h-1.5 rounded-full bg-[#1877f2]" title="Facebook"></div>
<div class="w-1.5 h-1.5 rounded-full bg-[#E1306C]" title="Instagram"></div>
</div>
<div class="hidden md:flex justify-center">
<span class="font-mono-label text-mono-label text-error bg-error/10 border border-error/20 px-2 py-0.5 rounded flex items-center gap-1">
                            FAILED
                        </span>
</div>
<div class="flex items-center justify-between md:justify-end gap-3 col-start-2 md:col-start-auto">
<button class="text-error font-mono-label text-mono-label hover:underline">Retry</button>
<span class="font-mono-data text-mono-data text-on-surface-variant text-right">
                            Oct 23, 14:30 PM
                        </span>
</div>
</div>
<!-- Row 3: Scheduled -->
<div class="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 md:gap-4 px-4 py-4 border-b border-outline-variant hover:bg-surface-container-high transition-colors group cursor-pointer items-center relative">
<div class="w-2 h-2 rounded-full bg-outline mt-1.5 md:mt-0"></div>
<div class="font-body-base text-body-base text-on-surface truncate pr-4">
                        Join us next week for a live webinar on navigating the new algorithmic changes...
                    </div>
<div class="hidden md:flex justify-center gap-1">
<div class="w-1.5 h-1.5 rounded-full bg-[#1da1f2]" title="Twitter"></div>
</div>
<div class="hidden md:flex justify-center">
<span class="font-mono-label text-mono-label text-on-surface-variant bg-surface-container-lowest border border-outline-variant px-2 py-0.5 rounded">SCHEDULED</span>
</div>
<div class="font-mono-data text-mono-data text-on-surface-variant text-right col-start-2 md:col-start-auto">
                        Oct 28, 10:00 AM
                    </div>
</div>
<!-- Row 4: Published -->
<div class="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 md:gap-4 px-4 py-4 border-b border-outline-variant hover:bg-surface-container-high transition-colors group cursor-pointer items-center relative">
<div class="w-2 h-2 rounded-full bg-[#10b981] mt-1.5 md:mt-0"></div>
<div class="font-body-base text-body-base text-on-surface truncate pr-4">
                        5 tips for optimizing your workflow before the weekend hits. Thread 🧵...
                    </div>
<div class="hidden md:flex justify-center gap-1">
<div class="w-1.5 h-1.5 rounded-full bg-[#1da1f2]" title="Twitter"></div>
<div class="w-1.5 h-1.5 rounded-full bg-[#0a66c2]" title="LinkedIn"></div>
<div class="w-1.5 h-1.5 rounded-full bg-[#E1306C]" title="Instagram"></div>
</div>
<div class="hidden md:flex justify-center">
<span class="font-mono-label text-mono-label text-on-surface-variant bg-surface-container-lowest border border-outline-variant px-2 py-0.5 rounded">PUBLISHED</span>
</div>
<div class="font-mono-data text-mono-data text-on-surface-variant text-right col-start-2 md:col-start-auto">
                        Oct 22, 16:45 PM
                    </div>
</div>
</div>
<!-- Pagination -->
<div class="mt-4 flex justify-center items-center gap-4">
<button class="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50">
<span class="material-symbols-outlined">chevron_left</span>
</button>
<span class="font-mono-data text-mono-data text-on-surface-variant">1 / 12</span>
<button class="text-on-surface-variant hover:text-primary transition-colors">
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>
</main>
</div>
</body>
</html>
```

---

### 4. Analytics

```html
<!-- OmniPost — Dashboard -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Analytics - OmniPost</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-tertiary-fixed-variant": "#454747",
                      "surface-container-highest": "#353434",
                      "surface-container": "#201f1f",
                      "primary-fixed-dim": "#c6c6c7",
                      "surface-variant": "#353434",
                      "on-secondary-fixed": "#1b1b1f",
                      "on-tertiary-container": "#636565",
                      "outline": "#8e9192",
                      "surface-tint": "#c6c6c7",
                      "on-secondary-container": "#b6b4b9",
                      "secondary-fixed": "#e4e1e7",
                      "primary-fixed": "#e2e2e2",
                      "primary": "#ffffff",
                      "secondary-fixed-dim": "#c8c5cb",
                      "on-primary-fixed-variant": "#454747",
                      "secondary-container": "#47464b",
                      "tertiary-fixed": "#e2e2e2",
                      "background": "#141313",
                      "inverse-on-surface": "#313030",
                      "surface-container-high": "#2a2a2a",
                      "inverse-primary": "#5d5f5f",
                      "on-tertiary-fixed": "#1a1c1c",
                      "on-tertiary": "#2f3131",
                      "on-error-container": "#ffdad6",
                      "inverse-surface": "#e5e2e1",
                      "on-surface": "#e5e2e1",
                      "outline-variant": "#444748",
                      "surface": "#141313",
                      "secondary": "#c8c5cb",
                      "surface-bright": "#3a3939",
                      "on-background": "#e5e2e1",
                      "on-primary": "#2f3131",
                      "on-secondary": "#303034",
                      "error-container": "#93000a",
                      "on-secondary-fixed-variant": "#47464b",
                      "surface-dim": "#141313",
                      "tertiary-container": "#e2e2e2",
                      "error": "#ffb4ab",
                      "on-error": "#690005",
                      "tertiary": "#ffffff",
                      "tertiary-fixed-dim": "#c6c6c7",
                      "primary-container": "#e2e2e2",
                      "surface-container-low": "#1c1b1b",
                      "on-surface-variant": "#c4c7c8",
                      "on-primary-fixed": "#1a1c1c",
                      "on-primary-container": "#636565",
                      "surface-container-lowest": "#0e0e0e"
              },
              "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
              "spacing": { "margin-mobile": "16px", "panel-padding": "20px", "unit": "4px", "gutter": "16px", "margin-desktop": "24px" },
              "fontFamily": { "body-sm": ["Inter"], "mono-data": ["Geist Mono"], "headline-md": ["Inter"], "body-base": ["Inter"], "headline-lg": ["Inter"], "mono-label": ["Geist Mono"] },
              "fontSize": {
                      "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                      "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                      "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                      "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                      "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                      "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
              }
            },
          },
        }
    </script>
<style>
        .material-symbols-outlined {
          font-variation-settings:
          'FILL' 0,
          'wght' 400,
          'GRAD' 0,
          'opsz' 24
        }
    </style>
</head>
<body class="bg-background text-on-background font-body-base overflow-x-hidden min-h-screen flex text-body-base">
<!-- SideNavBar -->
<nav class="hidden md:flex flex-col h-full py-panel-padding bg-surface-container-low dark:bg-surface-container-low fixed left-0 top-0 w-[240px] border-r border-outline-variant dark:border-outline-variant z-50">
<div class="px-margin-desktop mb-8">
<h1 class="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary tracking-tighter">OmniPost</h1>
<p class="font-body-sm text-body-sm text-on-surface-variant">Management Console</p>
</div>
<div class="flex-1 overflow-y-auto">
<ul class="space-y-1">
<li>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined" style="font-size: 20px;">dashboard</span>
<span class="font-mono-label text-mono-label">Dashboard</span>
</a>
</li>
<li>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined" style="font-size: 20px;">calendar_today</span>
<span class="font-mono-label text-mono-label">Calendar</span>
</a>
</li>
<li>
<a class="flex items-center gap-3 text-primary dark:text-primary border-l-2 border-primary py-2 px-4 bg-surface-container dark:bg-surface-container scale-[0.98] transition-transform" href="#">
<span class="material-symbols-outlined" style="font-size: 20px;">insights</span>
<span class="font-mono-label text-mono-label">Analytics</span>
</a>
</li>
<li>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200" href="#">
<span class="material-symbols-outlined" style="font-size: 20px;">settings</span>
<span class="font-mono-label text-mono-label">Settings</span>
</a>
</li>
</ul>
</div>
<div class="px-margin-desktop mt-auto pt-4 border-t border-outline-variant">
<button class="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2 px-4 rounded font-mono-label text-mono-label hover:opacity-90 transition-opacity">
<span class="material-symbols-outlined" style="font-size: 18px;">edit_square</span>
                Compose
            </button>
</div>
</nav>
<!-- Main Content Area -->
<main class="flex-1 w-full md:ml-[240px] flex flex-col min-h-screen">
<!-- TopNavBar -->
<header class="flex justify-between items-center px-margin-desktop h-14 bg-background dark:bg-background border-b border-outline-variant dark:border-outline-variant sticky top-0 z-40">
<div class="flex items-center gap-4">
<h2 class="font-headline-md text-headline-md text-primary dark:text-primary font-bold">Analytics</h2>
</div>
<div class="flex items-center gap-4">
<span class="font-mono-data text-mono-data text-on-surface-variant">UTC-05:00</span>
<img alt="User Profile" class="w-8 h-8 rounded-full border border-outline-variant object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAlTXnq84XFqh-4Qnr7KlHI1-SZXrnJk56k54u8Wae3fWRNxj3cxwNkYg_RQPnOeVIC5Th62GosV9cyiFVV5j4Yq2kNN8akpwwaAnevB9Eiw1xJXmS8JiTOyTv5NNyhbJorRDJzGA3T0RTrDgUDObd5RldgwNJOcx-5YAZE6YSJ75cgDQ5OE9ceNOTSCNSPMDuiBvECq6BPNBrOKSu2k0znZW4bJVri2Ij8YyzcpZpQTFgCF5wJ4lEnBQ"/>
</div>
</header>
<!-- Canvas -->
<div class="flex-1 p-margin-desktop bg-background">
<div class="flex justify-between items-end mb-6">
<div>
<h3 class="font-headline-md text-headline-md text-primary mb-1">Performance Overview</h3>
<p class="font-body-sm text-body-sm text-on-surface-variant">Last 30 days vs previous period.</p>
</div>
<div class="flex items-center gap-3">
<span class="font-mono-label text-mono-label text-outline uppercase">Next refresh in 4:12</span>
<button class="bg-surface-container-highest border border-outline-variant text-primary px-3 py-1.5 rounded flex items-center gap-2 font-mono-label text-mono-label hover:bg-surface-variant transition-colors">
<span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
                        Refresh Metrics
                    </button>
</div>
</div>
<!-- 5 Stat Blocks -->
<div class="grid grid-cols-1 md:grid-cols-5 gap-gutter mb-8">
<!-- Block 1 -->
<div class="bg-[#101012] border border-[#1F1F23] rounded p-panel-padding hover:bg-surface-container-high transition-colors">
<p class="font-mono-label text-mono-label text-on-surface-variant uppercase mb-2">Posts This Month</p>
<div class="flex items-baseline gap-2">
<span class="font-mono-data text-2xl text-primary leading-none">142</span>
<span class="font-mono-label text-mono-label text-secondary">+12%</span>
</div>
</div>
<!-- Block 2 -->
<div class="bg-[#101012] border border-[#1F1F23] rounded p-panel-padding hover:bg-surface-container-high transition-colors">
<p class="font-mono-label text-mono-label text-on-surface-variant uppercase mb-2">Total Impressions</p>
<div class="flex items-baseline gap-2">
<span class="font-mono-data text-2xl text-primary leading-none">1.2M</span>
<span class="font-mono-label text-mono-label text-error">-4%</span>
</div>
</div>
<!-- Block 3 -->
<div class="bg-[#101012] border border-[#1F1F23] rounded p-panel-padding hover:bg-surface-container-high transition-colors">
<p class="font-mono-label text-mono-label text-on-surface-variant uppercase mb-2">Avg. Engagement</p>
<div class="flex items-baseline gap-2">
<span class="font-mono-data text-2xl text-primary leading-none">4.8%</span>
<span class="font-mono-label text-mono-label text-secondary">+0.2%</span>
</div>
</div>
<!-- Block 4 -->
<div class="bg-[#101012] border border-[#1F1F23] rounded p-panel-padding hover:bg-surface-container-high transition-colors">
<p class="font-mono-label text-mono-label text-on-surface-variant uppercase mb-2">Link Clicks</p>
<div class="flex items-baseline gap-2">
<span class="font-mono-data text-2xl text-primary leading-none">8,405</span>
<span class="font-mono-label text-mono-label text-secondary">+22%</span>
</div>
</div>
<!-- Block 5 -->
<div class="bg-[#101012] border border-[#1F1F23] rounded p-panel-padding hover:bg-surface-container-high transition-colors">
<div class="flex justify-between items-start mb-2">
<p class="font-mono-label text-mono-label text-on-surface-variant uppercase">Conversion Rate</p>
<span class="bg-[#3A2A1A] text-[#FFB347] font-mono-label text-mono-label px-1.5 py-0.5 rounded uppercase border border-[#5A3A1A] text-[10px]">Stale</span>
</div>
<div class="flex items-baseline gap-2">
<span class="font-mono-data text-2xl text-primary leading-none">2.1%</span>
<span class="font-mono-label text-mono-label text-on-surface-variant">--</span>
</div>
</div>
</div>
<h4 class="font-mono-label text-mono-label text-primary uppercase mb-4 tracking-widest border-b border-[#1F1F23] pb-2">Per-Platform Metrics</h4>
<!-- Table -->
<div class="bg-[#101012] border border-[#1F1F23] rounded overflow-hidden">
<table class="w-full text-left border-collapse">
<thead>
<tr class="border-b border-[#1F1F23] bg-surface-container-lowest">
<th class="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant uppercase font-normal w-1/3">Post Excerpt</th>
<th class="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant uppercase font-normal w-1/5">Platform</th>
<th class="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant uppercase font-normal text-right">Impressions</th>
<th class="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant uppercase font-normal text-right">Likes</th>
<th class="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant uppercase font-normal text-right">Retweets/Shares</th>
</tr>
</thead>
<tbody class="font-body-sm text-body-sm">
<tr class="border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<td class="py-3 px-4 text-on-background truncate max-w-[200px]">Announcing our new Q3 roadmap...</td>
<td class="py-3 px-4 flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-[#1DA1F2]"></span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Twitter</span>
</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">45,210</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">1,204</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">342</td>
</tr>
<tr class="border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<td class="py-3 px-4 text-on-background truncate max-w-[200px]">Behind the scenes at the design sync.</td>
<td class="py-3 px-4 flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-[#E1306C]"></span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Instagram</span>
</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">82,100</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">8,450</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">112</td>
</tr>
<tr class="border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<td class="py-3 px-4 text-on-background truncate max-w-[200px]">We're hiring for 5 open engineering roles.</td>
<td class="py-3 px-4 flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-[#0A66C2]"></span>
<span class="font-mono-data text-mono-data text-on-surface-variant">LinkedIn</span>
</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">15,400</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">420</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">85</td>
</tr>
<tr class="border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<td class="py-3 px-4 text-on-background truncate max-w-[200px]">Quick tip: Automate your morning deploys.</td>
<td class="py-3 px-4 flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-[#1DA1F2]"></span>
<span class="font-mono-data text-mono-data text-on-surface-variant">Twitter</span>
</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">22,800</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">890</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">145</td>
</tr>
<tr class="hover:bg-[#1F1F23] transition-colors group">
<td class="py-3 px-4 text-on-background truncate max-w-[200px]">The state of UI design in 2024.</td>
<td class="py-3 px-4 flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-[#FF0000]"></span>
<span class="font-mono-data text-mono-data text-on-surface-variant">YouTube</span>
</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">145,000</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">12,400</td>
<td class="py-3 px-4 font-mono-data text-mono-data text-primary text-right">890</td>
</tr>
</tbody>
</table>
</div>
</div>
</main>
</body>
</html>
```

---

### 5. Compose

```html
<!-- OmniPost — Analytics -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>OmniPost - Compose</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-tertiary-fixed-variant": "#454747",
                        "surface-container-highest": "#353434",
                        "surface-container": "#201f1f",
                        "primary-fixed-dim": "#c6c6c7",
                        "surface-variant": "#353434",
                        "on-secondary-fixed": "#1b1b1f",
                        "on-tertiary-container": "#636565",
                        "outline": "#8e9192",
                        "surface-tint": "#c6c6c7",
                        "on-secondary-container": "#b6b4b9",
                        "secondary-fixed": "#e4e1e7",
                        "primary-fixed": "#e2e2e2",
                        "primary": "#ffffff",
                        "secondary-fixed-dim": "#c8c5cb",
                        "on-primary-fixed-variant": "#454747",
                        "secondary-container": "#47464b",
                        "tertiary-fixed": "#e2e2e2",
                        "background": "#141313",
                        "inverse-on-surface": "#313030",
                        "surface-container-high": "#2a2a2a",
                        "inverse-primary": "#5d5f5f",
                        "on-tertiary-fixed": "#1a1c1c",
                        "on-tertiary": "#2f3131",
                        "on-error-container": "#ffdad6",
                        "inverse-surface": "#e5e2e1",
                        "on-surface": "#e5e2e1",
                        "outline-variant": "#444748",
                        "surface": "#141313",
                        "secondary": "#c8c5cb",
                        "surface-bright": "#3a3939",
                        "on-background": "#e5e2e1",
                        "on-primary": "#2f3131",
                        "on-secondary": "#303034",
                        "error-container": "#93000a",
                        "on-secondary-fixed-variant": "#47464b",
                        "surface-dim": "#141313",
                        "tertiary-container": "#e2e2e2",
                        "error": "#ffb4ab",
                        "on-error": "#690005",
                        "tertiary": "#ffffff",
                        "tertiary-fixed-dim": "#c6c6c7",
                        "primary-container": "#e2e2e2",
                        "surface-container-low": "#1c1b1b",
                        "on-surface-variant": "#c4c7c8",
                        "on-primary-fixed": "#1a1c1c",
                        "on-primary-container": "#636565",
                        "surface-container-lowest": "#0e0e0e"
                    },
                    "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
                    "spacing": { "margin-mobile": "16px", "panel-padding": "20px", "unit": "4px", "gutter": "16px", "margin-desktop": "24px" },
                    "fontFamily": { "body-sm": ["Inter"], "mono-data": ["Geist Mono"], "headline-md": ["Inter"], "body-base": ["Inter"], "headline-lg": ["Inter"], "mono-label": ["Geist Mono"] },
                    "fontSize": {
                        "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                        "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                        "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                        "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                        "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                        "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
                    }
                }
            }
        }
    </script>
<style>
        body { background-color: #0A0A0B; color: #e5e2e1; }
        .platform-dot.twitter { background-color: #1DA1F2; }
        .platform-dot.linkedin { background-color: #0A66C2; }
        .platform-dot.instagram { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
        textarea:focus { outline: none; box-shadow: none; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #353434; border-radius: 4px; }
    </style>
</head>
<body class="bg-background text-on-background font-body-base h-screen overflow-hidden flex">
<!-- SideNavBar -->
<nav class="fixed left-0 top-0 h-full w-[240px] bg-surface-container-low dark:bg-surface-container-low border-r border-outline-variant dark:border-outline-variant flex flex-col py-panel-padding z-20 hidden md:flex">
<div class="px-margin-desktop mb-8">
<h1 class="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary tracking-tighter">OmniPost</h1>
<p class="font-mono-label text-mono-label text-on-surface-variant">Management Console</p>
</div>
<div class="flex-1 px-4 space-y-2">
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="font-headline-md text-headline-md">Dashboard</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" data-icon="calendar_today">calendar_today</span>
<span class="font-headline-md text-headline-md">Calendar</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" data-icon="insights">insights</span>
<span class="font-headline-md text-headline-md">Analytics</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span class="font-headline-md text-headline-md">Settings</span>
</a>
</div>
<div class="px-margin-desktop mt-auto">
<button class="w-full bg-primary text-on-primary py-2 px-4 rounded-DEFAULT font-headline-md text-headline-md hover:bg-opacity-90 transition-opacity">
                Compose
            </button>
</div>
</nav>
<!-- Main Content Area -->
<main class="flex-1 ml-0 md:ml-[240px] flex flex-col h-full bg-[#0A0A0B] relative">
<!-- TopNavBar -->
<header class="h-14 flex justify-between items-center px-margin-desktop border-b border-outline-variant dark:border-outline-variant bg-background dark:bg-background z-10 w-full shrink-0">
<div class="flex items-center gap-4">
<span class="font-headline-md text-headline-md text-primary font-bold">Compose</span>
</div>
<div class="flex items-center gap-6">
<span class="font-mono-data text-mono-data text-on-surface-variant">UTC-05:00</span>
<img alt="User Profile" class="w-8 h-8 rounded-full border border-outline-variant object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcAC6Hhe0LXEaq0fl3L0QjZZQ7a8nkyTrmpThgAaQAujUl3yzmnh80qXugxxvf7dpn-zAs_CrkH48GA58DK_DiiQTzYn70p2DGX3H7VAJA6xP5Qe1mAuwSLwoSSawR-bKFNajkL2fyaJJzdO4oXsRL8sD0ZtHcRYpeNZbwl5jJln5JSxcfHGZCzzfV3dGvJ7H7--rsf3H10S7BDGManzjvUWXvhJicZGVFdmkJc5oHqPJTu5uN_xN-Wg"/>
</div>
</header>
<!-- Scrollable Composer Area -->
<div class="flex-1 overflow-y-auto px-margin-mobile md:px-margin-desktop py-6 pb-32">
<div class="max-w-4xl mx-auto space-y-8">
<!-- Platform Selector -->
<div class="flex flex-wrap gap-2">
<button class="flex items-center gap-2 px-3 py-1.5 bg-[#101012] border border-[#1F1F23] rounded-DEFAULT hover:border-outline-variant transition-colors">
<div class="w-1.5 h-1.5 rounded-full platform-dot twitter"></div>
<span class="font-mono-label text-mono-label text-on-surface">@omnipost_app</span>
</button>
<button class="flex items-center gap-2 px-3 py-1.5 bg-[#101012] border border-[#1F1F23] rounded-DEFAULT hover:border-outline-variant transition-colors">
<div class="w-1.5 h-1.5 rounded-full platform-dot linkedin"></div>
<span class="font-mono-label text-mono-label text-on-surface">OmniPost Inc.</span>
</button>
<button class="flex items-center gap-2 px-3 py-1.5 bg-[#101012] border border-[#1F1F23] rounded-DEFAULT opacity-50 hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-[16px] text-on-surface-variant" data-icon="add">add</span>
<span class="font-mono-label text-mono-label text-on-surface-variant">Add Platform</span>
</button>
</div>
<!-- Main Composer Container -->
<div class="bg-[#101012] border border-[#1F1F23] rounded-lg p-6 relative">
<textarea class="w-full bg-transparent border-none text-primary font-body-base resize-none h-40 p-0 placeholder:text-on-surface-variant focus:ring-0" placeholder="What's on your mind? Start typing to generate variations..."></textarea>
<div class="flex justify-between items-end mt-4">
<div class="flex gap-2">
<button class="flex items-center justify-center w-8 h-8 rounded-DEFAULT hover:bg-[#1F1F23] text-on-surface-variant transition-colors">
<span class="material-symbols-outlined text-[20px]" data-icon="image">image</span>
</button>
<button class="flex items-center justify-center w-8 h-8 rounded-DEFAULT hover:bg-[#1F1F23] text-on-surface-variant transition-colors">
<span class="material-symbols-outlined text-[20px]" data-icon="mood">mood</span>
</button>
<button class="flex items-center justify-center w-8 h-8 rounded-DEFAULT hover:bg-[#1F1F23] text-on-surface-variant transition-colors">
<span class="material-symbols-outlined text-[20px]" data-icon="tag">tag</span>
</button>
</div>
<div class="flex items-center gap-4">
<button class="flex items-center gap-2 px-3 py-1.5 rounded-DEFAULT bg-[#1F1F23] hover:bg-surface-container-high transition-colors text-primary border border-[#1F1F23]">
<span class="material-symbols-outlined text-[16px]" data-icon="auto_awesome">auto_awesome</span>
<span class="font-mono-label text-mono-label">AI Adapt</span>
</button>
<span class="font-mono-data text-mono-data text-on-surface-variant">0 / 280</span>
</div>
</div>
</div>
<!-- Variant Cards Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<!-- Twitter Variant -->
<div class="bg-[#101012] border border-[#1F1F23] rounded-lg p-5 flex flex-col h-full hover:border-outline-variant transition-colors">
<div class="flex justify-between items-center mb-3">
<div class="flex items-center gap-2">
<div class="w-1.5 h-1.5 rounded-full platform-dot twitter"></div>
<span class="font-headline-md text-headline-md text-primary">Twitter (X)</span>
</div>
<button class="text-on-surface-variant hover:text-primary">
<span class="material-symbols-outlined text-[18px]" data-icon="edit">edit</span>
</button>
</div>
<p class="font-body-base text-body-base text-on-surface flex-1 mb-4">
                            Just pushing out the new update for our dark-mode composer. It's built for speed and density. Who else loves designing for power users? ⚡️ #UI #DesignSystem
                        </p>
<div class="flex justify-between items-center pt-3 border-t border-[#1F1F23]">
<span class="font-mono-label text-mono-label text-on-surface-variant flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]" data-icon="check">check</span> image attached
                            </span>
<span class="font-mono-data text-mono-data text-on-surface-variant">168 / 280</span>
</div>
</div>
<!-- LinkedIn Variant -->
<div class="bg-[#101012] border border-[#1F1F23] rounded-lg p-5 flex flex-col h-full hover:border-outline-variant transition-colors">
<div class="flex justify-between items-center mb-3">
<div class="flex items-center gap-2">
<div class="w-1.5 h-1.5 rounded-full platform-dot linkedin"></div>
<span class="font-headline-md text-headline-md text-primary">LinkedIn</span>
</div>
<button class="text-on-surface-variant hover:text-primary">
<span class="material-symbols-outlined text-[18px]" data-icon="edit">edit</span>
</button>
</div>
<p class="font-body-base text-body-base text-on-surface flex-1 mb-4">
                            We are excited to announce the rollout of our new high-density composer interface. By minimizing decorative elements and focusing on clear structural borders, we've increased workflow efficiency by 40%. Check out our latest case study on designing for professional social media managers. 🚀
                        </p>
<div class="flex justify-between items-center pt-3 border-t border-[#1F1F23]">
<span class="font-mono-label text-mono-label text-on-surface-variant flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]" data-icon="check">check</span> image attached
                            </span>
<span class="font-mono-data text-mono-data text-error">304 / 300</span>
</div>
</div>
</div>
</div>
</div>
<!-- Sticky Bottom Bar -->
<div class="absolute bottom-0 left-0 w-full bg-[#0A0A0B]/90 backdrop-blur-sm border-t border-[#1F1F23] px-margin-desktop py-4 z-10 flex justify-between items-center">
<span class="font-mono-label text-mono-label text-on-surface-variant">Unsaved Draft • UTC-05:00</span>
<div class="flex items-center gap-3">
<button class="px-6 py-2 bg-transparent border border-[#1F1F23] text-primary rounded-DEFAULT font-headline-md text-headline-md hover:bg-[#101012] transition-colors">
                    Schedule
                </button>
<button class="px-6 py-2 bg-primary text-black rounded-DEFAULT font-headline-md text-headline-md font-bold hover:bg-opacity-90 transition-opacity">
                    Publish now
                </button>
</div>
</div>
</main>
</body>
</html>
```

---

### 6. Settings → Connected Accounts

```html
<!-- OmniPost — Compose -->
<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Settings - Connected Accounts</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-tertiary-fixed-variant": "#454747",
                      "surface-container-highest": "#353434",
                      "surface-container": "#201f1f",
                      "primary-fixed-dim": "#c6c6c7",
                      "surface-variant": "#353434",
                      "on-secondary-fixed": "#1b1b1f",
                      "on-tertiary-container": "#636565",
                      "outline": "#8e9192",
                      "surface-tint": "#c6c6c7",
                      "on-secondary-container": "#b6b4b9",
                      "secondary-fixed": "#e4e1e7",
                      "primary-fixed": "#e2e2e2",
                      "primary": "#ffffff",
                      "secondary-fixed-dim": "#c8c5cb",
                      "on-primary-fixed-variant": "#454747",
                      "secondary-container": "#47464b",
                      "tertiary-fixed": "#e2e2e2",
                      "background": "#141313",
                      "inverse-on-surface": "#313030",
                      "surface-container-high": "#2a2a2a",
                      "inverse-primary": "#5d5f5f",
                      "on-tertiary-fixed": "#1a1c1c",
                      "on-tertiary": "#2f3131",
                      "on-error-container": "#ffdad6",
                      "inverse-surface": "#e5e2e1",
                      "on-surface": "#e5e2e1",
                      "outline-variant": "#444748",
                      "surface": "#141313",
                      "secondary": "#c8c5cb",
                      "surface-bright": "#3a3939",
                      "on-background": "#e5e2e1",
                      "on-primary": "#2f3131",
                      "on-secondary": "#303034",
                      "error-container": "#93000a",
                      "on-secondary-fixed-variant": "#47464b",
                      "surface-dim": "#141313",
                      "tertiary-container": "#e2e2e2",
                      "error": "#ffb4ab",
                      "on-error": "#690005",
                      "tertiary": "#ffffff",
                      "tertiary-fixed-dim": "#c6c6c7",
                      "primary-container": "#e2e2e2",
                      "surface-container-low": "#1c1b1b",
                      "on-surface-variant": "#c4c7c8",
                      "on-primary-fixed": "#1a1c1c",
                      "on-primary-container": "#636565",
                      "surface-container-lowest": "#0e0e0e"
              },
              "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
              "spacing": { "margin-mobile": "16px", "panel-padding": "20px", "unit": "4px", "gutter": "16px", "margin-desktop": "24px" },
              "fontFamily": { "body-sm": ["Inter"], "mono-data": ["Geist Mono"], "headline-md": ["Inter"], "body-base": ["Inter"], "headline-lg": ["Inter"], "mono-label": ["Geist Mono"] },
              "fontSize": {
                      "body-sm": ["13px", { "lineHeight": "18px", "fontWeight": "400" }],
                      "mono-data": ["13px", { "lineHeight": "16px", "fontWeight": "400" }],
                      "headline-md": ["18px", { "lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "500" }],
                      "body-base": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
                      "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
                      "mono-label": ["11px", { "lineHeight": "14px", "fontWeight": "500" }]
              }
            },
          }
        }
    </script>
<style>
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0A0A0B; }
        ::-webkit-scrollbar-thumb { background: #1F1F23; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #353434; }
    </style>
</head>
<body class="bg-background text-on-background antialiased flex h-screen overflow-hidden font-body-base text-body-base">
<!-- SideNavBar -->
<nav class="bg-surface-container-low dark:bg-surface-container-low fixed left-0 top-0 h-full w-[240px] border-r border-outline-variant dark:border-outline-variant flex flex-col py-panel-padding hidden md:flex">
<div class="px-4 mb-8">
<h1 class="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary tracking-tighter">OmniPost</h1>
<p class="font-mono-label text-mono-label text-on-surface-variant mt-1">Management Console</p>
</div>
<div class="flex-1 flex flex-col gap-1 px-2">
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">dashboard</span>
<span class="font-headline-md text-headline-md text-sm">Dashboard</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">calendar_today</span>
<span class="font-headline-md text-headline-md text-sm">Calendar</span>
</a>
<a class="flex items-center gap-3 text-on-surface-variant dark:text-on-surface-variant py-2 px-4 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 rounded-DEFAULT" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">insights</span>
<span class="font-headline-md text-headline-md text-sm">Analytics</span>
</a>
<a class="flex items-center gap-3 text-primary dark:text-primary border-l-2 border-primary py-2 px-4 bg-surface-container dark:bg-surface-container hover:bg-surface-container-high dark:hover:bg-surface-container-high transition-colors duration-200 active:scale-[0.98] transition-transform rounded-r-DEFAULT" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">settings</span>
<span class="font-headline-md text-headline-md text-sm font-medium">Settings</span>
</a>
</div>
<div class="px-4 mt-auto">
<button class="w-full bg-primary text-on-primary py-2 px-4 rounded-DEFAULT font-headline-md text-headline-md text-sm hover:bg-surface-tint transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0; font-size: 18px;">edit</span>
                Compose
            </button>
<div class="mt-6 flex items-center gap-3 border-t border-outline-variant pt-4 px-2">
<img alt="User Avatar" class="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1CVDP8EB--CnEVDwcyZf9VEdgm9yo34FeIQt4RziKjkMg1yFfG8VLnNbBqRQ7P2OTtDnCMtaiypYH_4lXB0W_i5ckiEpOY0e9A4IdRQc8ZdDfzRClVy4_7uZC0Z1q6D1hnIOzqF64e4e0i3Q_KusRDv2T_1-FIm01eI3lOjCRvQKV6Y9zF7Ucy6CBzmTJ8rdu8NsBAqZO1G0DijUYht382eaRZla4mfLzxvzBWxEfUxyyD6uVz4uHEA"/>
<div class="flex flex-col">
<span class="font-body-sm text-body-sm font-medium text-primary">Admin User</span>
<span class="font-mono-label text-mono-label text-on-surface-variant">@admin_omni</span>
</div>
</div>
</div>
</nav>
<!-- Main Content Area -->
<main class="flex-1 ml-0 md:ml-[240px] flex flex-col h-full relative">
<!-- TopNavBar -->
<header class="bg-background dark:bg-background docked full-width top h-14 border-b border-outline-variant dark:border-outline-variant flex justify-between items-center px-margin-desktop shrink-0">
<div class="flex items-center gap-4">
<span class="font-headline-md text-headline-md text-primary font-bold">Settings</span>
<span class="text-on-surface-variant text-sm mx-2">/</span>
<span class="font-headline-md text-headline-md text-on-surface-variant text-sm">Connected Accounts</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono-data text-mono-data text-on-surface-variant">UTC-05:00</span>
<img alt="User Profile" class="w-6 h-6 rounded-full object-cover md:hidden" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDipIWhofAPoD67td9_ZeuyJsgWAIR1uw37QTiZxTIpv3HwAGhpuZSnFz1eXwkl5P035emNTckOVO6sM3zCcQP72MSt3aF9kXQ7XHYKutTc0Raciu2CKo-XfRagoMeYK70gFAm3PSUREV7G0Ziwq4mATr2X4CPT0T72tmTl01xnp753nnktKNPb3TMahkSfu1QWlrPuEgGOZmYC2uvxiUbE_-pWxMWABcpcYfXFSS0VKjH8wc3bWyALTA"/>
</div>
</header>
<!-- Canvas -->
<div class="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop bg-[#0A0A0B]">
<div class="max-w-4xl mx-auto space-y-6">
<div>
<h2 class="font-headline-lg text-headline-lg text-primary">Connected accounts</h2>
<p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Manage the social platforms OmniPost has access to.</p>
</div>
<!-- Account List Container -->
<div class="bg-[#101012] border border-[#1F1F23] rounded-lg overflow-hidden flex flex-col">
<!-- Platform 1 (Connected) -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-6 h-6 rounded-full bg-[#1DA1F2] flex items-center justify-center shrink-0">
<span class="font-mono-label text-[10px] text-white font-bold">X</span>
</div>
<div class="flex flex-col">
<span class="font-headline-md text-headline-md text-sm text-primary">Twitter (X)</span>
<div class="flex items-center gap-2 mt-0.5">
<span class="font-mono-label text-mono-label text-on-surface-variant">@omnipost_hq</span>
</div>
</div>
</div>
<div class="flex items-center gap-4">
<span class="px-2 py-0.5 rounded text-[10px] font-mono-label text-emerald-400 border border-emerald-400/20 bg-emerald-400/10">CONNECTED</span>
<button class="font-body-sm text-body-sm text-error/80 hover:text-error transition-colors px-3 py-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100">
                                Disconnect
                            </button>
</div>
</div>
<!-- Platform 2 (Disconnected) -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors">
<div class="flex items-center gap-4">
<div class="w-6 h-6 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
<span class="font-mono-label text-[10px] text-white font-bold">in</span>
</div>
<div class="flex flex-col">
<span class="font-headline-md text-headline-md text-sm text-primary">LinkedIn</span>
<span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Not connected</span>
</div>
</div>
<div class="flex items-center gap-4">
<button class="bg-transparent border border-[#1F1F23] text-primary px-4 py-1.5 rounded font-body-sm text-body-sm hover:bg-[#2a2a2a] transition-colors" onclick="document.getElementById('connect-modal').classList.remove('hidden')">
                                Connect
                            </button>
</div>
</div>
<!-- Platform 3 (Connected) -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors group">
<div class="flex items-center gap-4">
<div class="w-6 h-6 rounded-full bg-[#E1306C] flex items-center justify-center shrink-0">
<span class="font-mono-label text-[10px] text-white font-bold">ig</span>
</div>
<div class="flex flex-col">
<span class="font-headline-md text-headline-md text-sm text-primary">Instagram</span>
<div class="flex items-center gap-2 mt-0.5">
<span class="font-mono-label text-mono-label text-on-surface-variant">@omnipost_official</span>
</div>
</div>
</div>
<div class="flex items-center gap-4">
<span class="px-2 py-0.5 rounded text-[10px] font-mono-label text-emerald-400 border border-emerald-400/20 bg-emerald-400/10">CONNECTED</span>
<button class="font-body-sm text-body-sm text-error/80 hover:text-error transition-colors px-3 py-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100">
                                Disconnect
                            </button>
</div>
</div>
<!-- Platform 4 (Disconnected) -->
<div class="flex items-center justify-between p-4 border-b border-[#1F1F23] hover:bg-[#1F1F23] transition-colors">
<div class="flex items-center gap-4">
<div class="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
<span class="font-mono-label text-[10px] text-white font-bold">f</span>
</div>
<div class="flex flex-col">
<span class="font-headline-md text-headline-md text-sm text-primary">Facebook Pages</span>
<span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Not connected</span>
</div>
</div>
<div class="flex items-center gap-4">
<button class="bg-transparent border border-[#1F1F23] text-primary px-4 py-1.5 rounded font-body-sm text-body-sm hover:bg-[#2a2a2a] transition-colors">
                                Connect
                            </button>
</div>
</div>
<!-- Platform 5 (Disconnected) -->
<div class="flex items-center justify-between p-4 hover:bg-[#1F1F23] transition-colors">
<div class="flex items-center gap-4">
<div class="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center shrink-0">
<span class="font-mono-label text-[10px] text-white font-bold">yt</span>
</div>
<div class="flex flex-col">
<span class="font-headline-md text-headline-md text-sm text-primary">YouTube</span>
<span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Not connected</span>
</div>
</div>
<div class="flex items-center gap-4">
<button class="bg-transparent border border-[#1F1F23] text-primary px-4 py-1.5 rounded font-body-sm text-body-sm hover:bg-[#2a2a2a] transition-colors">
                                Connect
                            </button>
</div>
</div>
</div>
</div>
</div>
</main>
<!-- Connect Modal Overlay -->
<div class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/60 backdrop-blur-sm" id="connect-modal">
<div class="bg-[#101012] border border-[#1F1F23] w-full max-w-md rounded-lg shadow-2xl overflow-hidden flex flex-col">
<div class="p-6 pb-4 flex justify-between items-start">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
<span class="font-mono-label text-xs text-white font-bold">in</span>
</div>
<h3 class="font-headline-md text-headline-md text-primary">Authorize LinkedIn</h3>
</div>
<button class="text-on-surface-variant hover:text-primary transition-colors" onclick="document.getElementById('connect-modal').classList.add('hidden')">
<span class="material-symbols-outlined" style="font-size: 20px;">close</span>
</button>
</div>
<div class="p-6 pt-2 flex-1">
<p class="font-body-sm text-body-sm text-on-surface-variant mb-6">Authorize OmniPost to post as your LinkedIn profile. Please confirm the handle you wish to connect.</p>
<div class="space-y-2">
<label class="font-mono-label text-mono-label text-on-surface-variant block">LINKEDIN HANDLE</label>
<div class="relative">
<span class="absolute left-3 top-1/2 -translate-y-1/2 font-mono-data text-mono-data text-on-surface-variant">@</span>
<input class="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-DEFAULT py-2 pl-7 pr-3 text-primary font-mono-data text-mono-data focus:outline-none focus:border-primary transition-colors" placeholder="username" type="text" value="omnipost_hq"/>
</div>
</div>
</div>
<div class="p-4 border-t border-[#1F1F23] flex justify-end gap-3 bg-[#0A0A0B]/50">
<button class="px-4 py-2 font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" onclick="document.getElementById('connect-modal').classList.add('hidden')">
                    Cancel
                </button>
<button class="bg-primary text-on-primary px-6 py-2 rounded-DEFAULT font-headline-md text-headline-md text-sm hover:bg-surface-tint transition-colors active:scale-[0.98]" onclick="document.getElementById('connect-modal').classList.add('hidden')">
                    Authorize
                </button>
</div>
</div>
</div>
</body>
</html>
```
