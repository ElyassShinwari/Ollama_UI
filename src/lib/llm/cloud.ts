import type { ModelRef, Provider } from "@/lib/chat/types";

export const CLOUD_LABEL: Record<Exclude<Provider, "ollama">, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  xai: "Grok",
  kimi: "Kimi",
};

export const FALLBACK_CLOUD: Record<Exclude<Provider, "ollama">, ModelRef[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", transport: "server", family: "gpt", contextLength: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o mini", provider: "openai", transport: "server", family: "gpt", contextLength: 128000 },
    { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", transport: "server", family: "gpt", contextLength: 1047576 },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
    { id: "claude-3-5-haiku-latest", name: "Claude Haiku 3.5", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
  ],
  xai: [
    { id: "grok-4.5", name: "Grok 4.5", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-4", name: "Grok 4", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-3", name: "Grok 3", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-3-mini", name: "Grok 3 Mini", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
  ],
  kimi: [
    { id: "kimi-k2-0905-preview", name: "Kimi K2", provider: "kimi", transport: "server", family: "kimi", contextLength: 256000 },
    { id: "moonshot-v1-128k", name: "Moonshot 128k", provider: "kimi", transport: "server", family: "kimi", contextLength: 128000 },
    { id: "moonshot-v1-32k", name: "Moonshot 32k", provider: "kimi", transport: "server", family: "kimi", contextLength: 32000 },
  ],
};

export function cloudEndpoint(provider: Exclude<Provider, "ollama">) {
  if (provider === "openai") return { url: "https://api.openai.com/v1/chat/completions", models: "https://api.openai.com/v1/models" };
  if (provider === "xai") return { url: "https://api.x.ai/v1/chat/completions", models: "https://api.x.ai/v1/models" };
  if (provider === "kimi") return { url: "https://api.moonshot.ai/v1/chat/completions", models: "https://api.moonshot.ai/v1/models" };
  return { url: "https://api.anthropic.com/v1/messages", models: "https://api.anthropic.com/v1/models" };
}

export function reviewSatisfied(text: string) {
  const head = text.trim().slice(0, 200);
  return /^(SATISFIED|APPROVED|LGTM)\b/i.test(head) || /\bSATISFIED\b/i.test(head.split("\n")[0] ?? "");
}

export const REVIEW_SYSTEM =
  "You are reviewing another model's answer. If it is correct, complete, and safe, start your reply with SATISFIED on its own first line, then one short note. If it is not good enough, do not write SATISFIED. List concrete fixes the author must apply.";
