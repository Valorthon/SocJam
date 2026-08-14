import { NextResponse } from "next/server";
import type { getAuthenticatedUser } from "@/lib/auth";
import { buildAdaptPostPrompt } from "@/lib/ai/prompts/adaptPost";
import { assertSafeSocialCopy } from "@/lib/ai/safety";
import {
  getConstraints,
  PLATFORMS,
  type MediaValidationInput,
  type Platform,
  validatePost,
} from "@/lib/platforms/constraints";
import type { PlatformConstraints } from "@/lib/platforms/types";
import type { AIProvider, AiAdaptInput } from "@/lib/ai/provider";
import {
  aiAdaptationQuotaResponseSchema,
  aiAdaptRequestSchema,
  aiAdaptResponseSchema,
  type AiAdaptationQuota,
} from "@/lib/validations/ai";

const AI_DAILY_LIMIT_DEFAULT = 20;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface AiGenerationInput {
  userId: string;
  platform: Platform;
  prompt: string;
  output: string;
  model: string;
}

export interface AiQuotaReservation {
  allowed: boolean;
  quota: AiAdaptationQuota;
}

export interface AiAdaptRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  provider: AIProvider;
  countGenerationsSince: (userId: string, since: Date) => Promise<number>;
  reserveGenerations: (input: {
    userId: string;
    since: Date;
    limit: number;
    generations: AiGenerationInput[];
  }) => Promise<AiQuotaReservation>;
  getDailyLimit?: () => number;
  now?: () => Date;
}

export function getAiDailyLimit(value = process.env.AI_DAILY_LIMIT): number {
  if (!value) return AI_DAILY_LIMIT_DEFAULT;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : AI_DAILY_LIMIT_DEFAULT;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function invalidResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}

function quotaExceededResponse(): NextResponse {
  return NextResponse.json(
    { error: "Daily AI adaptation limit reached. Try again later." },
    { status: 429 },
  );
}

function quotaFor(
  used: number,
  limit: number,
): AiAdaptationQuota {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

function mediaValidationInput(
  media: { hasImages: boolean; hasVideo: boolean },
): MediaValidationInput[] {
  return [
    ...(media.hasImages ? [{ type: "IMAGE" as const }] : []),
    ...(media.hasVideo ? [{ type: "VIDEO" as const }] : []),
  ];
}

function strictestPlatformFor(platforms: readonly Platform[]): Platform {
  const [firstPlatform, ...remainingPlatforms] = platforms;
  if (!firstPlatform) {
    throw new Error("At least one platform is required.");
  }

  return remainingPlatforms.reduce((strictestPlatform, platform) => {
    const platformMaxChars = getConstraints(platform).maxChars;
    const strictestMaxChars = getConstraints(strictestPlatform).maxChars;

    if (platformMaxChars < strictestMaxChars) {
      return platform;
    }

    if (
      platformMaxChars === strictestMaxChars &&
      PLATFORMS.indexOf(platform) < PLATFORMS.indexOf(strictestPlatform)
    ) {
      return platform;
    }

    return strictestPlatform;
  }, firstPlatform);
}

function sharedConstraintsFor(
  platforms: readonly Platform[],
  strictestPlatform: Platform,
): PlatformConstraints {
  const strictestConstraints = getConstraints(strictestPlatform);

  return {
    ...strictestConstraints,
    maxChars: Math.min(
      ...platforms.map((platform) => getConstraints(platform).maxChars),
    ),
    requiresImage: platforms.some(
      (platform) => getConstraints(platform).requiresImage,
    ),
    requiresVideo: platforms.some(
      (platform) => getConstraints(platform).requiresVideo,
    ),
  };
}

export function createAiAdaptRouteHandler(
  dependencies: AiAdaptRouteDependencies,
) {
  const getQuota = async (userId: string): Promise<AiAdaptationQuota> => {
    const now = (dependencies.now ?? (() => new Date()))();
    const used = await dependencies.countGenerationsSince(
      userId,
      new Date(now.getTime() - DAY_IN_MS),
    );
    const limit = (dependencies.getDailyLimit ?? getAiDailyLimit)();
    return quotaFor(used, limit);
  };

  async function GET(): Promise<NextResponse> {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) return unauthorizedResponse();

    try {
      return NextResponse.json(
        aiAdaptationQuotaResponseSchema.parse({
          quota: await getQuota(authentication.userId),
        }),
      );
    } catch (error) {
      console.error("Unable to load AI adaptation quota.", error);
      return NextResponse.json(
        { error: "Unable to load AI adaptation quota." },
        { status: 500 },
      );
    }
  }

  async function POST(request: Request): Promise<NextResponse> {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) return unauthorizedResponse();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidResponse();
    }

    const parsed = aiAdaptRequestSchema.safeParse(body);
    if (!parsed.success) return invalidResponse();

    try {
      const quota = await getQuota(authentication.userId);
      const requestedGenerations = parsed.data.sharedCaption
        ? 1
        : parsed.data.platforms.length;
      if (quota.used + requestedGenerations > quota.limit) {
        return quotaExceededResponse();
      }

      const mediaForValidation = mediaValidationInput(parsed.data.media);
      const generatedVariants = parsed.data.sharedCaption
        ? await (async () => {
          const platform = strictestPlatformFor(parsed.data.platforms);
          const input: AiAdaptInput = {
            baseText: parsed.data.baseText,
            platform,
            targetPlatforms: parsed.data.platforms,
            tone: parsed.data.tone,
            media: parsed.data.media,
            constraints: sharedConstraintsFor(parsed.data.platforms, platform),
          };
          const text = await dependencies.provider.adapt(input);
          assertSafeSocialCopy(text);
          const prompt = buildAdaptPostPrompt(input);

          return parsed.data.platforms.map((targetPlatform) => {
            const validation = validatePost(
              targetPlatform,
              text,
              mediaForValidation,
            );

            return {
              platform: targetPlatform,
              text,
              valid: validation.valid,
              errors: validation.errors,
              prompt,
              reservedPlatform: platform,
            };
          });
        })()
        : await Promise.all(parsed.data.platforms.map(async (platform) => {
          const input: AiAdaptInput = {
            baseText: parsed.data.baseText,
            platform,
            targetPlatforms: [platform],
            tone: parsed.data.tone,
            media: parsed.data.media,
            constraints: getConstraints(platform),
          };
          const text = await dependencies.provider.adapt(input);
          assertSafeSocialCopy(text);
          const validation = validatePost(platform, text, mediaForValidation);

          return {
            platform,
            text,
            valid: validation.valid,
            errors: validation.errors,
            prompt: buildAdaptPostPrompt(input),
            reservedPlatform: platform,
          };
        }));

      const generations = parsed.data.sharedCaption
        ? generatedVariants.slice(0, 1).map((variant) => ({
          userId: authentication.userId,
          platform: variant.reservedPlatform,
          prompt: variant.prompt,
          output: variant.text,
          model: dependencies.provider.model,
        }))
        : generatedVariants.map((variant) => ({
          userId: authentication.userId,
          platform: variant.platform,
          prompt: variant.prompt,
          output: variant.text,
          model: dependencies.provider.model,
        }));

      const reservation = await dependencies.reserveGenerations({
        userId: authentication.userId,
        since: new Date(
          (dependencies.now ?? (() => new Date()))().getTime() - DAY_IN_MS,
        ),
        limit: quota.limit,
        generations,
      });
      if (!reservation.allowed) return quotaExceededResponse();

      return NextResponse.json(aiAdaptResponseSchema.parse({
        variants: generatedVariants.map(({
          prompt: _prompt,
          reservedPlatform: _reservedPlatform,
          ...variant
        }) => variant),
        model: dependencies.provider.model,
        quota: reservation.quota,
      }));
    } catch (error) {
      console.error("Unable to adapt post with AI.", error);
      return NextResponse.json({ error: "AI adaptation failed." }, { status: 502 });
    }
  }

  return { GET, POST };
}
