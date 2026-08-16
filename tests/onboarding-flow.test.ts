import assert from "node:assert/strict";

import {
  completeSignupFlow,
  SIGNUP_ONBOARDING_PATH,
} from "../src/lib/auth/signup-flow";
import { getOnboardingRedirect } from "../src/lib/onboarding/redirects";

async function run(): Promise<void> {
  assert.equal(
    getOnboardingRedirect({
      isAuthenticated: false,
      hasConnectedAccount: false,
    }),
    "/login",
  );
  assert.equal(
    getOnboardingRedirect({
      isAuthenticated: true,
      hasConnectedAccount: true,
    }),
    "/dashboard",
  );
  assert.equal(
    getOnboardingRedirect({
      isAuthenticated: true,
      hasConnectedAccount: false,
    }),
    null,
  );

  const calls: string[] = [];
  const successfulSignup = await completeSignupFlow(
    {
      name: "SocJam User",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    },
    {
      register: async () => {
        calls.push("register");
        return { success: true };
      },
      login: async () => {
        calls.push("login");
        return { success: true };
      },
    },
  );

  assert.deepEqual(calls, ["register", "login"]);
  assert.deepEqual(successfulSignup, {
    success: true,
    redirectTo: SIGNUP_ONBOARDING_PATH,
  });

  const failedRegistration = await completeSignupFlow(
    {
      name: "",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    },
    {
      register: async () => ({
        success: false,
        fieldErrors: { name: "Name is required" },
      }),
      login: async () => {
        throw new Error("Login should not run after a failed registration");
      },
    },
  );

  assert.equal(failedRegistration.success, false);
  if (!failedRegistration.success) {
    assert.equal(failedRegistration.stage, "registration");
  }

  const failedLogin = await completeSignupFlow(
    {
      name: "SocJam User",
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    },
    {
      register: async () => ({ success: true }),
      login: async () => ({
        success: false,
        error: "Invalid email or password.",
      }),
    },
  );

  assert.equal(failedLogin.success, false);
  if (!failedLogin.success) {
    assert.equal(failedLogin.stage, "login");
  }

  console.log("Onboarding flow tests passed.");
}

void run();
