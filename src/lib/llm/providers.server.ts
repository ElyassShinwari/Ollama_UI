import { FALLBACK_CLOUD, cloudEndpoint, type CloudId } from "@/lib/llm/cloud";
import { parseOllamaCapabilities, parseOllamaContextLength, xaiContextLength } from "@/lib/llm/context";
import { sanitizeOllamaHost } from "@/lib/utils";
import type { ModelRef, TokenUsage } from "@/lib/chat/types";

type OllamaTag = {
  name: string;
  size?: number;
  details?: {
    family?: string;
    parameter_size?: string;
  };
};

type XaiModel = {
  id: string;
  object?: string;
};

export type ChatStreamEvent = {
  content?: string;
  usage?: TokenUsage;
};

function isChatXaiModel(id: string) {
  const lower = id.toLowerCase();
  if (!lower.startsWith("grok")) return false;
  if (
    lower.includes("imagine") ||
    lower.includes("image") ||
    lower.includes("tts") ||
    lower.includes("video") ||
    lower.includes("embedding") ||
    lower.includes("whisper") ||
    lower.includes("build") ||
    lower.includes("multi-agent")
  ) {
    return false;
  }
  if (/\d{4}/.test(lower)) return false;
  return true;
}

function displayXaiName(id: string) {
  if (id === "grok-4.5") return "Grok 4.5";
  return id
    .replace(/^grok-/, "Grok ")
    .replace(/-/g, " ")
    .replace(/\bmini\b/i, "Mini");
}

export async function fetchOllamaContext(
  host: string,
  name: string,
): Promise<{ contextLength?: number; capabilities?: string[] } | undefined> {
  try {
    const res = await fetch(`${host}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(700),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as {
      model_info?: Record<string, unknown>;
      parameters?: string;
      capabilities?: unknown;
      projector_info?: unknown;
      details?: { family?: string };
    };
    return {
      contextLength: parseOllamaContextLength(body),
      capabilities: parseOllamaCapabilities(body, name),
    };
  } catch {
    return undefined;
  }
}

export async function listOllamaModels(hostRaw: string): Promise<ModelRef[]> {
  const host = sanitizeOllamaHost(hostRaw);
  const res = await fetch(`${host}/api/tags`, {
    signal: AbortSignal.timeout(400),
  });
  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`);
  }
  const body = (await res.json()) as { models?: OllamaTag[] };
  const base = (body.models ?? []).map((m) => ({
    id: m.name,
    name: m.name,
    provider: "ollama" as const,
    transport: "server" as const,
    size: m.size,
    family: m.details?.family,
    parameterSize: m.details?.parameter_size,
  }));
  return Promise.all(
    base.map(async (model) => {
      const meta = await fetchOllamaContext(host, model.id);
      if (!meta) return model;
      return {
        ...model,
        ...(meta.contextLength ? { contextLength: meta.contextLength } : {}),
        ...(meta.capabilities?.length ? { capabilities: meta.capabilities } : {}),
      };
    }),
  );
}

export async function unloadOllamaModel(hostRaw: string, model: string) {
  const host = sanitizeOllamaHost(hostRaw);
  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "",
      keep_alive: 0,
      stream: false,
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Ollama unload failed ${res.status}`);
  }
}

export async function listXaiModels(): Promise<ModelRef[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.x.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return [
        {
          id: "grok-4.5",
          name: "Grok 4.5",
          provider: "xai",
          transport: "server",
          contextLength: xaiContextLength("grok-4.5"),
        },
      ];
    }
    const body = (await res.json()) as { data?: XaiModel[] };
    const models = (body.data ?? [])
      .map((m) => m.id)
      .filter(isChatXaiModel)
      .map(
        (id): ModelRef => ({
          id,
          name: displayXaiName(id),
          provider: "xai",
          transport: "server",
          contextLength: xaiContextLength(id),
        }),
      );
    if (models.length === 0) {
      return [
        {
          id: "grok-4.5",
          name: "Grok 4.5",
          provider: "xai",
          transport: "server",
          contextLength: xaiContextLength("grok-4.5"),
        },
      ];
    }
    const preferred = ["grok-4.5", "grok-4", "grok-3"];
    models.sort((a, b) => {
      const ai = preferred.indexOf(a.id);
      const bi = preferred.indexOf(b.id);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return models;
  } catch {
    return [
      {
        id: "grok-4.5",
        name: "Grok 4.5",
        provider: "xai",
        transport: "server",
        contextLength: xaiContextLength("grok-4.5"),
      },
    ];
  }
}

export async function* streamOllamaChat(opts: {
  host: string;
  model: string;
  messages: { role: string; content: string; images?: string[] }[];
  temperature: number;
  contextLength?: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const host = sanitizeOllamaHost(opts.host);
  const options: Record<string, number> = { temperature: opts.temperature };
  if (opts.contextLength && opts.contextLength > 0) {
    options.num_ctx = opts.contextLength;
  }
  options.repeat_penalty = 1.2;
  options.repeat_last_n = 256;
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
      options,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Ollama error ${res.status}`);
  }
  if (!res.body) throw new Error("Ollama returned an empty stream");
  yield* readOllamaNdjson(res.body);
}

export async function* streamXaiChat(opts: {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Cloud models are not available in this environment");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      stream: true,
      max_tokens: 4096,
      stream_options: { include_usage: true },
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `xAI error ${res.status}`);
  }
  if (!res.body) throw new Error("xAI returned an empty stream");
  yield* readXaiSse(res.body);
}

export async function listCloudModels(
  provider: CloudId,
  apiKey: string,
): Promise<ModelRef[]> {
  if (!apiKey.trim()) return [];
  const fallback = FALLBACK_CLOUD[provider];
  try {
    const ep = cloudEndpoint(provider);
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      delete headers.Authorization;
    }
    const res = await fetch(ep.models, { headers, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return fallback;
    const body = (await res.json()) as { data?: { id: string }[] };
    const ids = (body.data ?? []).map((m) => m.id);
    if (ids.length === 0) return fallback;
    const filtered = ids.filter((id) => isCloudChatModel(provider, id));
    const seen = new Set<string>();
    const out: ModelRef[] = [];
    for (const model of fallback) {
      if (filtered.includes(model.id) || filtered.length === 0) {
        out.push(model);
        seen.add(model.id);
      }
    }
    for (const id of filtered) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: id,
        provider,
        transport: "server",
        contextLength: fallback[0]?.contextLength,
      });
      if (out.length >= 8) break;
    }
    return out.length ? out : fallback;
  } catch {
    return fallback;
  }
}

function isCloudChatModel(provider: CloudId, id: string) {
  const l = id.toLowerCase();
  if (/(audio|realtime|image|imagine|video|tts|stt|whisper|embedding|moderation|transcribe)/.test(l)) {
    return false;
  }
  if (provider === "openai") return /^(gpt-4|gpt-5|o[1-4]|chatgpt)/.test(l);
  if (provider === "anthropic") return l.includes("claude");
  if (provider === "xai") return l.startsWith("grok");
  if (provider === "deepseek") return l.includes("deepseek");
  return l.includes("kimi") || l.includes("moonshot");
}

export async function* streamOpenAiCompat(opts: {
  url: string;
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  signal: AbortSignal;
  extraHeaders?: Record<string, string>;
}): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Cloud error ${res.status}`);
  }
  if (!res.body) throw new Error("Empty stream");
  yield* readXaiSse(res.body);
}

export async function* streamAnthropicChat(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const messages = opts.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      temperature: opts.temperature,
      system: system || undefined,
      messages,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Anthropic error ${res.status}`);
  }
  if (!res.body) throw new Error("Empty stream");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          type?: string;
          delta?: { text?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (json.delta?.text) yield { content: json.delta.text };
        if (json.usage) {
          yield {
            usage: {
              promptTokens: Number(json.usage.input_tokens) || 0,
              completionTokens: Number(json.usage.output_tokens) || 0,
            },
          };
        }
      } catch {
        /* skip */
      }
    }
  }
}


async function* readOllamaNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line) as {
          message?: { content?: string };
          error?: string;
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        if (json.error) throw new Error(json.error);
        if (json.message?.content) yield { content: json.message.content };
        const promptTokens = Number(json.prompt_eval_count) || 0;
        const completionTokens = Number(json.eval_count) || 0;
        if (promptTokens || completionTokens) {
          yield { usage: { promptTokens, completionTokens } };
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}

async function* readXaiSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield { content };
        if (json.usage) {
          yield {
            usage: {
              promptTokens: Number(json.usage.prompt_tokens) || 0,
              completionTokens: Number(json.usage.completion_tokens) || 0,
            },
          };
        }
      } catch {
        /* skip malformed */
      }
    }
  }
}
