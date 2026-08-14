import { createGroqProvider } from "@/lib/ai/groq";
import { createOpenAiProvider } from "@/lib/ai/openai";
import type { AIProvider } from "@/lib/ai/provider";

export function defaultAiProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();

  if (provider === "openai") return createOpenAiProvider();
  if (provider === "groq") return createGroqProvider();

  throw new Error("Unsupported AI provider configuration.");
}
