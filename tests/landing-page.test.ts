import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landingPage = readFileSync("src/app/page.tsx", "utf8");
const brandMark = readFileSync(
  "src/components/features/landing/BrandMark.tsx",
  "utf8",
);
const productPreview = readFileSync(
  "src/components/features/landing/ProductPreview.tsx",
  "utf8",
);
const sidebarContent = readFileSync(
  "src/components/features/shell/SidebarContent.tsx",
  "utf8",
);
const platformIcon = readFileSync(
  "src/components/features/accounts/PlatformIcon.tsx",
  "utf8",
);
const loginPage = readFileSync("src/app/(auth)/login/page.tsx", "utf8");
const signupPage = readFileSync("src/app/(auth)/signup/page.tsx", "utf8");
const footerMatch = landingPage.match(/<footer[\s\S]*?<\/footer>/);

assert.doesNotMatch(landingPage, /Your social command center/);
assert.match(landingPage, /<h1 className="[^"]*tracking-\[-0\.03em\][^"]*">/);
assert.ok(footerMatch, "Landing page must render a footer");

const footer = footerMatch[0];
assert.doesNotMatch(footer, /BrandMark/);
assert.doesNotMatch(footer, /Sign in/);
assert.doesNotMatch(footer, /Get started/);
assert.match(footer, /All rights reserved\./);
assert.match(brandMark, /src="\/branding\/logo-light\.svg"/);
assert.match(brandMark, /width=\{60\}/);
assert.match(brandMark, /height=\{60\}/);
assert.doesNotMatch(productPreview, /<BrandMark\s*\/>\s*SocJam/);
assert.match(productPreview, /FaXTwitter/);
assert.match(productPreview, /FaFacebookF/);
assert.match(productPreview, /FaInstagram/);
assert.match(productPreview, /FaTiktok/);
assert.match(productPreview, /FaLinkedinIn/);
assert.match(platformIcon, /FaXTwitter/);
assert.match(platformIcon, /FaFacebookF/);
assert.match(platformIcon, /FaInstagram/);
assert.match(platformIcon, /FaTiktok/);
assert.match(platformIcon, /FaLinkedinIn/);
assert.match(loginPage, /src="\/branding\/logo-light\.svg"/);
assert.match(signupPage, /src="\/branding\/logo-light\.svg"/);
assert.doesNotMatch(sidebarContent, /<span className="font-semibold tracking-tight">SocJam<\/span>/);
assert.match(
  sidebarContent,
  /<Link href="\/dashboard"[\s\S]*?src="\/branding\/logo-light\.svg"/,
);
assert.match(sidebarContent, /src="\/branding\/logo-light\.svg"[\s\S]*?width=\{60\}/);
assert.match(sidebarContent, /src="\/branding\/logo-light\.svg"[\s\S]*?height=\{60\}/);
assert.match(
  sidebarContent,
  /<Link href="\/dashboard" className="mb-6 flex items-center px-3">/,
);

console.log("Landing page content tests passed.");
