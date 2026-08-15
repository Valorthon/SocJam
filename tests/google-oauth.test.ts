import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authConfig = readFileSync("src/lib/auth.ts", "utf8");
const loginPage = readFileSync("src/app/(auth)/login/page.tsx", "utf8");

// Auth configuration
assert.match(authConfig, /import GoogleProvider from "next-auth\/providers\/google";/);
assert.match(authConfig, /GOOGLE_CLIENT_ID/);
assert.match(authConfig, /GOOGLE_CLIENT_SECRET/);
assert.match(authConfig, /allowDangerousEmailAccountLinking: true/);
assert.match(authConfig, /newUser: "\/onboarding"/);
assert.match(authConfig, /function isGoogleOAuthEnabled/);
assert.match(authConfig, /function buildGoogleProvider/);

// Login page wiring
assert.match(loginPage, /import { signIn } from "next-auth\/react";/);
assert.match(loginPage, /signIn\("google"/);
assert.match(loginPage, /redirectTo: "\/onboarding"/);

// OAuth error handling surfaces sanitized messages for known error codes
assert.match(loginPage, /case "OAuthCallback":/);
assert.match(loginPage, /case "OAuthCreateAccount":/);
assert.match(loginPage, /case "AccessDenied":/);
assert.match(loginPage, /case "Configuration":/);
assert.doesNotMatch(loginPage, /setComingSoonFeature\("Google sign-in"\)/);

console.log("Google OAuth tests passed.");
