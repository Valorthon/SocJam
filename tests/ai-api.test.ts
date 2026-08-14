import assert from "node:assert/strict";
import {
  createAiAdaptRouteHandler,
  getAiDailyLimit,
  type AiGenerationInput,
  type AiQuotaReservation,
} from "../src/lib/ai/route-handlers";
import type { AiAdaptInput } from "../src/lib/ai/provider";
import { createGroqProvider } from "../src/lib/ai/groq";
import { createOpenAiProvider } from "../src/lib/ai/openai";
import { defaultAiProvider } from "../src/lib/ai/registry";
import { assertSafeSocialCopy } from "../src/lib/ai/safety";
import { getConstraints } from "../src/lib/platforms/constraints";
import { aiAdaptResponseSchema } from "../src/lib/validations/ai";

function reserveInMemory(generations: AiGenerationInput[]) {
  return async (input: {
    limit: number;
    generations: AiGenerationInput[];
  }): Promise<AiQuotaReservation> => {
    const used = generations.length;
    const remaining = Math.max(0, input.limit - used);
    if (input.generations.length > remaining) {
      return {
        allowed: false,
        quota: { used, limit: input.limit, remaining },
      };
    }

    generations.push(...input.generations);
    const updatedUsed = used + input.generations.length;
    return {
      allowed: true,
      quota: {
        used: updatedUsed,
        limit: input.limit,
        remaining: input.limit - updatedUsed,
      },
    };
  };
}

async function reserveFromEmptyQuota(input: {
  limit: number;
  generations: AiGenerationInput[];
}): Promise<AiQuotaReservation> {
  return {
    allowed: true,
    quota: {
      used: input.generations.length,
      limit: input.limit,
      remaining: input.limit - input.generations.length,
    },
  };
}

async function run(): Promise<void> {
  const generations: AiGenerationInput[] = [];
  const handler = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: {
      model: "mock",
      adapt: async ({ platform }: AiAdaptInput) => `${platform} variant`,
    },
    countGenerationsSince: async () => generations.length,
    reserveGenerations: reserveInMemory(generations),
  });

  const response = await handler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Launch day is here",
      platforms: ["X", "LINKEDIN"],
      tone: "professional",
      media: { hasImages: false, hasVideo: false },
    }),
  }));

  assert.equal(response.status, 200);
  const responsePayload = aiAdaptResponseSchema.parse(await response.json());
  assert.equal(responsePayload.quota.remaining, 18);
  assert.equal(generations.length, 2);
  assert.deepEqual(
    generations.map((generation) => generation.platform),
    ["X", "LINKEDIN"],
  );
  assert.match(generations[0]?.prompt ?? "", /Adapt this social post for X/);

  const sharedGenerations: AiGenerationInput[] = [];
  const sharedProviderInputs: AiAdaptInput[] = [];
  const sharedHandler = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: {
      model: "mock",
      adapt: async (input: AiAdaptInput) => {
        sharedProviderInputs.push(input);
        return sharedProviderInputs.length === 1
          ? "Shared launch copy"
          : "Unexpected second generation";
      },
    },
    countGenerationsSince: async () => sharedGenerations.length,
    reserveGenerations: reserveInMemory(sharedGenerations),
  });
  const sharedResponse = await sharedHandler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Launch day is here",
      platforms: ["X", "LINKEDIN"],
      tone: "professional",
      media: { hasImages: false, hasVideo: false },
      sharedCaption: true,
    }),
  }));
  assert.equal(sharedResponse.status, 200);
  const sharedPayload = aiAdaptResponseSchema.parse(await sharedResponse.json());
  assert.equal(sharedProviderInputs.length, 1);
  assert.deepEqual(
    sharedPayload.variants.map((variant) => variant.text),
    ["Shared launch copy", "Shared launch copy"],
  );
  assert.equal(sharedPayload.quota.remaining, 19);
  assert.equal(sharedGenerations.length, 1);
  assert.equal(sharedGenerations[0]?.platform, "X");
  assert.match(sharedGenerations[0]?.prompt ?? "", /unchanged on: X, LINKEDIN/);
  assert.match(sharedGenerations[0]?.prompt ?? "", /below 280 characters/);

  const singlePlatformSharedGenerations: AiGenerationInput[] = [];
  const singlePlatformShared = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "Single shared copy" },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveInMemory(singlePlatformSharedGenerations),
  });
  const singlePlatformSharedResponse = await singlePlatformShared.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Hello",
      platforms: ["X"],
      sharedCaption: true,
    }),
  }));
  assert.equal(singlePlatformSharedResponse.status, 200);
  const singlePlatformSharedPayload = aiAdaptResponseSchema.parse(
    await singlePlatformSharedResponse.json(),
  );
  assert.deepEqual(
    singlePlatformSharedPayload.variants.map((variant) => ({
      platform: variant.platform,
      text: variant.text,
    })),
    [{ platform: "X", text: "Single shared copy" }],
  );
  assert.equal(singlePlatformSharedPayload.quota.remaining, 19);
  assert.equal(singlePlatformSharedGenerations.length, 1);
  assert.equal(singlePlatformSharedGenerations[0]?.platform, "X");

  const sharedTieGenerations: AiGenerationInput[] = [];
  const sharedTieBreaker = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "Shared media copy" },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveInMemory(sharedTieGenerations),
  });
  const sharedTieResponse = await sharedTieBreaker.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Hello",
      platforms: ["TIKTOK", "INSTAGRAM"],
      sharedCaption: true,
      media: { hasImages: true, hasVideo: true },
    }),
  }));
  assert.equal(sharedTieResponse.status, 200);
  assert.equal(
    sharedTieGenerations[0]?.platform,
    "INSTAGRAM",
    "equal character limits use PLATFORMS order for deterministic audit records",
  );

  const conflictingMedia = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "Shared visual copy" },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveFromEmptyQuota,
  });
  const conflictingMediaResponse = await conflictingMedia.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Hello",
      platforms: ["X", "TIKTOK"],
      sharedCaption: true,
      media: { hasImages: true, hasVideo: false },
    }),
  }));
  const conflictingMediaPayload = aiAdaptResponseSchema.parse(
    await conflictingMediaResponse.json(),
  );
  assert.deepEqual(
    conflictingMediaPayload.variants.map((variant) => ({
      platform: variant.platform,
      valid: variant.valid,
    })),
    [
      { platform: "X", valid: true },
      { platform: "TIKTOK", valid: false },
    ],
  );
  assert.match(
    conflictingMediaPayload.variants.find((variant) => variant.platform === "TIKTOK")?.errors.join(" ") ?? "",
    /requires a video|does not support images/,
  );

  let sharedFailureReserved = false;
  const sharedProviderFailure = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => { throw new Error("provider detail"); } },
    countGenerationsSince: async () => 0,
    reserveGenerations: async () => {
      sharedFailureReserved = true;
      return reserveFromEmptyQuota({ limit: 20, generations: [] });
    },
  });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const sharedProviderFailureResponse = await sharedProviderFailure.POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        baseText: "Hello",
        platforms: ["X", "LINKEDIN"],
        sharedCaption: true,
      }),
    }));
    assert.equal(sharedProviderFailureResponse.status, 502);
    assert.deepEqual(await sharedProviderFailureResponse.json(), {
      error: "AI adaptation failed.",
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(sharedFailureReserved, false);

  const sharedInvalidOutput = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "x".repeat(281) },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveFromEmptyQuota,
  });
  const sharedInvalidResponse = await sharedInvalidOutput.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Hello",
      platforms: ["X", "LINKEDIN"],
      sharedCaption: true,
    }),
  }));
  const sharedInvalidPayload = aiAdaptResponseSchema.parse(await sharedInvalidResponse.json());
  assert.deepEqual(
    sharedInvalidPayload.variants.map((variant) => ({
      platform: variant.platform,
      valid: variant.valid,
    })),
    [
      { platform: "X", valid: false },
      { platform: "LINKEDIN", valid: true },
    ],
  );

  const partialMedia = await handler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Launch day is here",
      platforms: ["INSTAGRAM"],
      media: { hasImages: true },
    }),
  }));
  assert.equal(partialMedia.status, 200);

  const invalidOutput = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "x".repeat(281) },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveFromEmptyQuota,
  });
  const invalidResponse = await invalidOutput.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ baseText: "Hello", platforms: ["X"] }),
  }));
  const invalidPayload = aiAdaptResponseSchema.parse(await invalidResponse.json());
  assert.equal(invalidPayload.variants[0].valid, false);

  const providerFailure = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => { throw new Error("provider detail"); } },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveFromEmptyQuota,
  });
  const originalConsoleErrorForProviderFailure = console.error;
  console.error = () => undefined;
  let failedResponse: Response;
  try {
    failedResponse = await providerFailure.POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ baseText: "Hello", platforms: ["X"] }),
    }));
  } finally {
    console.error = originalConsoleErrorForProviderFailure;
  }
  assert.equal(failedResponse.status, 502);
  assert.deepEqual(await failedResponse.json(), { error: "AI adaptation failed." });

  let unsafeGenerationReserved = false;
  const unsafeOutputHandler = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "```ts\nconst secret = 'x';\n```" },
    countGenerationsSince: async () => 0,
    reserveGenerations: async () => {
      unsafeGenerationReserved = true;
      return reserveFromEmptyQuota({ limit: 20, generations: [] });
    },
  });
  console.error = () => undefined;
  try {
    const unsafeOutputResponse = await unsafeOutputHandler.POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ baseText: "Hello", platforms: ["X"] }),
    }));
    assert.equal(unsafeOutputResponse.status, 502);
    assert.deepEqual(await unsafeOutputResponse.json(), { error: "AI adaptation failed." });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(unsafeGenerationReserved, false);

  const empty = await handler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ baseText: "", platforms: ["X"] }),
  }));
  assert.equal(empty.status, 400);

  const unauthenticated = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: false as const }),
    provider: { model: "mock", adapt: async () => "unused" },
    countGenerationsSince: async () => 0,
    reserveGenerations: reserveFromEmptyQuota,
  });
  assert.equal((await unauthenticated.POST(new Request("http://localhost"))).status, 401);
  assert.equal((await unauthenticated.GET()).status, 401);

  let usedGenerations = 19;
  const limitedHandler = createAiAdaptRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    provider: { model: "mock", adapt: async () => "adapted" },
    countGenerationsSince: async () => usedGenerations,
    reserveGenerations: async ({ limit, generations: created }) => {
      const remaining = Math.max(0, limit - usedGenerations);
      if (created.length > remaining) {
        return {
          allowed: false,
          quota: { used: usedGenerations, limit, remaining },
        };
      }

      usedGenerations += created.length;
      return {
        allowed: true,
        quota: {
          used: usedGenerations,
          limit,
          remaining: limit - usedGenerations,
        },
      };
    },
  });
  const atLimit = await limitedHandler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ baseText: "Hello", platforms: ["X"] }),
  }));
  assert.equal(atLimit.status, 200);
  assert.equal(usedGenerations, 20);

  usedGenerations = 19;
  const sharedAtLimit = await limitedHandler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      baseText: "Hello",
      platforms: ["X", "LINKEDIN"],
      sharedCaption: true,
    }),
  }));
  assert.equal(sharedAtLimit.status, 200);
  assert.equal(
    usedGenerations,
    20,
    "shared mode consumes one generation with multiple platforms",
  );

  const overLimit = await limitedHandler.POST(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ baseText: "Hello", platforms: ["X"] }),
  }));
  assert.equal(overLimit.status, 429);
  assert.deepEqual(await overLimit.json(), {
    error: "Daily AI adaptation limit reached. Try again later.",
  });

  assert.equal(getAiDailyLimit(undefined), 20);
  assert.equal(getAiDailyLimit("3"), 3);
  assert.equal(getAiDailyLimit("invalid"), 20);

  const quota = await limitedHandler.GET();
  assert.equal(quota.status, 200);
  assert.deepEqual(await quota.json(), {
    quota: { used: 20, limit: 20, remaining: 0 },
  });

  let groqRequest: Request | undefined;
  const groqProvider = createGroqProvider({
    apiKey: "groq-key",
    model: "llama-3.3-70b-versatile",
    fetcher: async (input, init) => {
      groqRequest = new Request(input, init);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Groq variant" } }],
      }), { status: 200 });
    },
  });
  assert.equal(await groqProvider.adapt({
    baseText: "Hello", platform: "X", tone: "professional",
    media: { hasImages: false, hasVideo: false }, constraints: getConstraints("X"),
  }), "Groq variant");
  assert.equal(groqRequest?.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(groqRequest?.headers.get("Authorization"), "Bearer groq-key");
  const groqPayload = await groqRequest?.json() as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    tools?: unknown;
    functions?: unknown;
  };
  assert.equal(groqPayload.model, "llama-3.3-70b-versatile");
  assert.deepEqual(groqPayload.messages.map((message) => message.role), ["system", "user"]);
  assert.match(groqPayload.messages[0]?.content ?? "", /only finished social-media post copy/i);
  assert.equal(groqPayload.tools, undefined);
  assert.equal(groqPayload.functions, undefined);

  let openAiRequest: Request | undefined;
  const openAiProvider = createOpenAiProvider({
    apiKey: "openai-key",
    fetcher: async (input, init) => {
      openAiRequest = new Request(input, init);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "OpenAI variant" } }],
      }), { status: 200 });
    },
  });
  assert.equal(await openAiProvider.adapt({
    baseText: "Hello", platform: "X", tone: "professional",
    media: { hasImages: false, hasVideo: false }, constraints: getConstraints("X"),
  }), "OpenAI variant");
  assert.equal(openAiProvider.model, "gpt-4o-mini");
  assert.equal(openAiRequest?.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(openAiRequest?.headers.get("Authorization"), "Bearer openai-key");
  const openAiPayload = await openAiRequest?.json() as {
    messages: Array<{ role: string; content: string }>;
    tools?: unknown;
    functions?: unknown;
  };
  assert.deepEqual(openAiPayload.messages.map((message) => message.role), ["system", "user"]);
  assert.equal(openAiPayload.tools, undefined);
  assert.equal(openAiPayload.functions, undefined);

  assert.doesNotThrow(() => assertSafeSocialCopy("Our API integration is live today."));
  assert.doesNotThrow(() => assertSafeSocialCopy("class is in session today!"));
  for (const safeSocialCopy of [
    "Const as a rock, our team stands firm.",
    "Type fast, win big.",
    "Import our values into your daily routine.",
    "Export your ideas and inspire the community.",
    "Node the date in your calendar.",
    "Python is our mascot for today.",
  ]) {
    assert.doesNotThrow(() => assertSafeSocialCopy(safeSocialCopy));
  }
  for (const unsafeText of [
    "```ts\nconst answer = 42;\n```",
    "<script>alert('x')</script>",
    "curl https://example.com/deploy",
    "import secret from './secret'",
    "export const answer = 42",
    "pnpm install",
    "class PostComposer {}",
  ]) {
    assert.throws(() => assertSafeSocialCopy(unsafeText), /unsafe executable syntax/i);
  }

  const previousEnvironment = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  try {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    process.env.GROQ_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    assert.equal(defaultAiProvider().model, "gpt-4o-mini");
    process.env.AI_PROVIDER = "groq";
    process.env.AI_MODEL = "groq-model";
    assert.equal(defaultAiProvider().model, "groq-model");
    process.env.AI_PROVIDER = "openai";
    process.env.AI_MODEL = "openai-model";
    assert.equal(defaultAiProvider().model, "openai-model");
    process.env.AI_PROVIDER = "unsupported";
    assert.throws(() => defaultAiProvider(), /unsupported AI provider/i);
  } finally {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }

  console.log("AI API tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
