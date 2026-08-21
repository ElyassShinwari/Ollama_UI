import { estimateTokens } from "@/lib/utils";
import type { Transport } from "@/lib/chat/types";

const cache = new Map<string, number>();

function cacheKey(model: string, text: string) {
  return `${model}::${text.length}::${text.slice(0, 64)}::${text.slice(-64)}`;
}

function remember(key: string, n: number) {
  cache.set(key, n);
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return n;
}

export function formatChatPrompt(
  systemPrompt: string,
  messages: { role: string; content: string }[],
) {
  const parts: string[] = [];
  if (systemPrompt.trim()) parts.push(`System: ${systemPrompt.trim()}`);
  for (const m of messages) {
    const who = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
    parts.push(`${who}: ${m.content}`);
  }
  return parts.join("\n");
}

export async function countModelTokens(opts: {
  host: string;
  model: string;
  text: string;
  transport: Transport;
}): Promise<number> {
  const text = opts.text;
  if (!text) return 0;
  const key = cacheKey(opts.model, text);
  const hit = cache.get(key);
  if (hit != null) return hit;

  try {
    const n =
      opts.transport === "browser"
        ? await tokenizeDirect(opts.host, opts.model, text)
        : await tokenizeViaServer(opts.host, opts.model, text);
    if (n != null) return remember(key, n);
  } catch {
    /* fall through */
  }
  return remember(key, estimateTokens(text));
}

async function tokenizeViaServer(host: string, model: string, prompt: string) {
  const res = await fetch("/api/tokenize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, model, prompt }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { count?: number };
  return typeof body.count === "number" ? body.count : null;
}

async function tokenizeDirect(host: string, model: string, prompt: string) {
  return tokenizeOllama(host.replace(/\/+$/, ""), model, prompt);
}

export async function tokenizeOllama(
  host: string,
  model: string,
  prompt: string,
): Promise<number | null> {
  const tryBody = async (payload: unknown) => {
    const res = await fetch(`${host}/api/tokenize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { tokens?: unknown };
    return Array.isArray(body.tokens) ? body.tokens.length : null;
  };
  return (await tryBody({ model, prompt })) ?? (await tryBody({ model, content: prompt }));
}
