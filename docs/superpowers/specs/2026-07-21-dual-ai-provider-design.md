# Dual AI Provider Design

## Goal

Restore OpenAI as SocJam's default AI provider while retaining Groq as an
explicit, interchangeable provider for the proof of concept.

## Provider selection

- `AI_PROVIDER` selects the provider: `openai` is the default and `groq` is
  the supported alternative.
- `AI_MODEL` overrides the selected provider's default model.
- OpenAI defaults to `gpt-4o-mini`; Groq defaults to
  `llama-3.3-70b-versatile`.
- `OPENAI_API_KEY` and `GROQ_API_KEY` are provider-specific. If the selected
  provider has no key, it returns the existing deterministic mock adaptation.
- An unsupported `AI_PROVIDER` value fails fast with a sanitized server-side
  configuration error rather than silently selecting another provider.

## Architecture

`src/lib/ai/openai.ts` and `src/lib/ai/groq.ts` each implement `AIProvider`
using the same shared response schema, timeout helper, prompt construction,
and mock fallback from `provider.ts`. Both send only system and user messages;
neither sends tool or function definitions.

`src/lib/ai/registry.ts` is the sole provider-selection boundary. Feature and
route code continue to call `defaultAiProvider()` and do not depend on either
vendor implementation.

## Documentation and examples

`.env.example`, `README.md`, `SPEC.md`, and `AGENTS.md` document OpenAI as the
default provider and Groq as the optional alternative. The examples keep both
API key variables blank and make no claim that an API key or paid credits are
included.

## Validation

Tests cover OpenAI's request shape and default-model behavior, Groq selection,
the `AI_MODEL` override for both providers, mock fallback without a selected
provider key, and rejection of unsupported provider names. Existing safety
tests and the full test, lint, and TypeScript checks remain required.
