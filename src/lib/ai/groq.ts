import {
  chatCompletionResponseSchema,
  mockAdaptation,
  timeoutSignal,
  type AIProvider,
  type AiAdaptInput,
} from "@/lib/ai/provider";
import {
  buildAdaptPostPrompt,
  buildAdaptPostSystemPrompt,
} from "@/lib/ai/prompts/adaptPost";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export function createGroqProvider(
  options: { apiKey?: string; model?: string; fetcher?: typeof fetch } = {},
): AIProvider {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const model = options.model ?? process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
  const fetcher = options.fetcher ?? fetch;

  return {
    model,
    async adapt(input: AiAdaptInput): Promise<string> {
      if (!apiKey) return mockAdaptation(input);

      let response: Response;
      try {
        response = await fetcher(GROQ_CHAT_COMPLETIONS_URL, {
          method: "POST",
          signal: timeoutSignal(),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
              { role: "system", content: buildAdaptPostSystemPrompt() },
              { role: "user", content: buildAdaptPostPrompt(input) },
            ],
          }),
        });
      } catch {
        throw new Error("AI provider request failed.");
      }

      if (!response.ok) {
        throw new Error("AI provider request failed.");
      }
      const parsed = chatCompletionResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("AI provider returned an invalid response.");
      }
      return parsed.data.choices[0].message.content.trim();
    },
  };
}
