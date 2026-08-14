import { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth";
import { defaultAiProvider } from "@/lib/ai/registry";
import {
  createAiAdaptRouteHandler,
  type AiGenerationInput,
} from "@/lib/ai/route-handlers";
import { db } from "@/lib/db";

const SERIALIZATION_RETRY_LIMIT = 3;
const SERIALIZATION_RETRY_DELAY_MS = 25;

function waitForSerializationRetry(attempt: number): Promise<void> {
  const delay = SERIALIZATION_RETRY_DELAY_MS * 2 ** attempt;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function reserveGenerations(input: {
  userId: string;
  since: Date;
  limit: number;
  generations: AiGenerationInput[];
}) {
  for (let attempt = 0; attempt < SERIALIZATION_RETRY_LIMIT; attempt += 1) {
    try {
      return await db.$transaction(async (transaction) => {
        const used = await transaction.aiGeneration.count({
          where: { userId: input.userId, createdAt: { gte: input.since } },
        });
        const remaining = Math.max(0, input.limit - used);

        if (input.generations.length > remaining) {
          return {
            allowed: false,
            quota: { used, limit: input.limit, remaining },
          };
        }

        await transaction.aiGeneration.createMany({ data: input.generations });
        const updatedUsed = used + input.generations.length;
        return {
          allowed: true,
          quota: {
            used: updatedUsed,
            limit: input.limit,
            remaining: input.limit - updatedUsed,
          },
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < SERIALIZATION_RETRY_LIMIT - 1
      ) {
        await waitForSerializationRetry(attempt);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to reserve AI adaptations.");
}

const handlers = createAiAdaptRouteHandler({
  getAuthenticatedUser,
  provider: defaultAiProvider(),
  countGenerationsSince: (userId, since) =>
    db.aiGeneration.count({
      where: { userId, createdAt: { gte: since } },
    }),
  reserveGenerations,
});

export const { GET, POST } = handlers;
