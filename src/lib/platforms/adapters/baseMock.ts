import type { PostTarget, SocialAccount } from "@prisma/client";
import {
  getConstraints,
  validatePost as validatePlatformPost,
  type Platform,
} from "@/lib/platforms/constraints";
import {
  analyticsResultSchema,
  authCheckResultSchema,
  publishResultSchema,
  type AnalyticsResult,
  type AuthCheckResult,
  type PublishInput,
  type PublishResult,
  type SocialPlatformAdapter,
} from "@/lib/platforms/types";

const MOCK_LATENCY_MS = 600;
const DAY_MS = 24 * 60 * 60 * 1000;

function hash(value: string): number {
  let result = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }

  return result >>> 0;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function getMockFailureRate(value = process.env.MOCK_FAILURE_RATE): number {
  if (value === undefined || value.trim() === "") {
    return 0;
  }

  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
}

function shouldFail(platform: Platform, targetId: string, rate: number): boolean {
  if (rate === 0) {
    return false;
  }

  return hash(`${platform}:${targetId}`) / 4294967296 < rate;
}

function buildAnalytics(target: PostTarget): AnalyticsResult {
  const seed = hash(target.id);
  const elapsedDays = target.publishedAt
    ? Math.max(0, Math.floor((Date.now() - target.publishedAt.getTime()) / DAY_MS))
    : 0;
  const impressions = 100 + (seed % 900) + elapsedDays * 15;
  const likes = 10 + ((seed >>> 8) % 90) + elapsedDays * 2;
  const comments = 1 + ((seed >>> 16) % 20) + Math.floor(elapsedDays / 2);
  const shares = (seed >>> 24) % 15 + Math.floor(elapsedDays / 3);

  return analyticsResultSchema.parse({
    impressions,
    likes,
    comments,
    shares,
  });
}

export class BaseMockAdapter implements SocialPlatformAdapter {
  readonly platform: Platform;
  private readonly successfulPublishes = new Map<string, PublishResult>();

  constructor(platform: Platform) {
    this.platform = platform;
  }

  getConstraints() {
    return getConstraints(this.platform);
  }

  validatePost(input: PublishInput): { valid: boolean; errors: string[] } {
    return validatePlatformPost(
      this.platform,
      input.text,
      input.media.map((asset) => ({
        type: asset.type,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      })),
    );
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    const cacheKey = `${this.platform}:${input.targetId}:${input.idempotencyKey}`;
    const previousResult = this.successfulPublishes.get(cacheKey);

    if (previousResult) {
      return previousResult;
    }

    await wait(MOCK_LATENCY_MS);

    const validation = this.validatePost(input);
    if (!validation.valid) {
      return publishResultSchema.parse({
        ok: false,
        error: validation.errors.join(". "),
        retryable: false,
      });
    }

    if (shouldFail(this.platform, input.targetId, getMockFailureRate())) {
      return publishResultSchema.parse({
        ok: false,
        error: `Mock ${this.platform} publishing failed.`,
        retryable: true,
      });
    }

    const result = publishResultSchema.parse({
      ok: true,
      publishedUrl: `https://mock.${this.platform.toLowerCase()}.local/post/${input.targetId}`,
    });

    this.successfulPublishes.set(cacheKey, result);
    return result;
  }

  async checkAuth(account: SocialAccount): Promise<AuthCheckResult> {
    // Token expiry is not modeled by mocks; RECONNECT_REQUIRED is the inactive test state.
    return authCheckResultSchema.parse({
      active: account.status === "ACTIVE",
      account,
    });
  }

  async fetchAnalytics(target: PostTarget): Promise<AnalyticsResult> {
    return buildAnalytics(target);
  }
}
