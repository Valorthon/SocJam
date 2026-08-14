import { z } from "zod";
import type { Platform } from "@/lib/platforms/constraints";
import type { PlatformConstraints } from "@/lib/platforms/types";
import type { AiTone } from "@/lib/validations/ai";

export interface AiAdaptInput {
  baseText: string;
  platform: Platform;
  targetPlatforms?: readonly Platform[];
  tone: AiTone;
  media: { hasImages: boolean; hasVideo: boolean };
  constraints: PlatformConstraints;
}

export interface AIProvider {
  readonly model: string;
  adapt(input: AiAdaptInput): Promise<string>;
}

export const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
});

export function mockAdaptation(input: AiAdaptInput): string {
  const prefix = `${input.platform}: `;
  const available = Math.max(0, input.constraints.maxChars - prefix.length);
  return `${prefix}${input.baseText.slice(0, available)}`.trim();
}

export function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(30_000);
}
