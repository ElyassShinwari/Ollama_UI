import { parseOllamaCapabilities, parseOllamaContextLength, xaiContextLength } from "@/lib/llm/context";
import { ensureCloudAuth } from "@/lib/llm/oauth-client";
import type { ModelCatalog, ModelRef, TokenUsage, Transport } from "@/lib/chat/types";

type ServerCatalog = {
  models: ModelRef[];
  ollama: boolean;
  xai: boolean;
  openai?: boolean;
  anthropic?: boolean;
  kimi?: boolean;
  deepseek?: boolean;
  error?: string;
};

async function attachBrowserContext(host: string, models: ModelRef[]): Promise<ModelRef[]> {
  const origin = host.replace(/\/+$/, "");
  return Promise.all(
    models.map(async (model) => {
      try {
        const res = await fetch(`${origin}/api/show`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: model.id }),
          signal: AbortSignal.timeout(2500),
        });
        if (!res.ok) return model;
        const body = (await res.json()) as {
          model_info?: Record<string, unknown>;
          parameters?: string;
          capabilities?: unknown;
          projector_info?: unknown;
          details?: { family?: string };
        };
        const contextLength = parseOllamaContextLength(body);
        const capabilities = parseOllamaCapabilities(body, model.id);
        return {
          ...model,
          contextLength: contextLength ?? model.contextLength,
          capabilities: capabilities.length ? capabilities : model.capabilities,
        };
      } catch {
        return model;
      }
    }),
  );
}

export async function probeBrowserOllama(host: string): Promise<ModelRef[]> {
  try {
    const res = await fetch(`${host.replace(/\/+$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      models?: {
        name: string;
        size?: number;
        details?: { family?: string; parameter_size?: string };
      }[];
    };
    const models = (body.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      provider: "ollama" as const,
      transport: "browser" as const,
      size: m.size,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
    }));
    return attachBrowserContext(host, models);
  } catch {
    return [];
  }
}

function mergeModels(browser: ModelRef[], server: ModelRef[]): ModelRef[] {
  const out: ModelRef[] = [];
  const seen = new Set<string>();
  for (const model of [...browser, ...server]) {
    const key = `${model.provider}:${model.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      model.provider === "xai" && !model.contextLength
        ? { ...model, contextLength: xaiContextLength(model.id) }
        : model,
    );
  }
  return out;
}

export async function fetchCatalog(
  host: string,
  browserModels: ModelRef[] = [],
  keys: { openai?: string; anthropic?: string; xai?: string; kimi?: string; deepseek?: string } = {},
): Promise<ModelCatalog> {
  await ensureCloudAuth();
  const headers: Record<string, string> = {};
  if (keys.openai) headers["x-openai-key"] = keys.openai;
  if (keys.anthropic) headers["x-anthropic-key"] = keys.anthropic;
  if (keys.xai) headers["x-xai-key"] = keys.xai;
  if (keys.kimi) headers["x-kimi-key"] = keys.kimi;
  if (keys.deepseek) headers["x-deepseek-key"] = keys.deepseek;
  const serverRes = await fetch(`/api/models?host=${encodeURIComponent(host)}`, { headers })
    .then(async (r) => {
      if (!r.ok) {
        return {
          models: [],
          ollama: false,
          openai: false,
          anthropic: false,
          xai: false,
          kimi: false,
          deepseek: false,
          error: `Catalog ${r.status}`,
        } satisfies ServerCatalog;
      }
      return (await r.json()) as ServerCatalog;
    })
    .catch(
      () =>
        ({
          models: [],
          ollama: false,
          openai: false,
          anthropic: false,
          xai: false,
          kimi: false,
          deepseek: false,
          error: "Could not reach the model catalog",
        }) satisfies ServerCatalog,
    );

  return {
    models: mergeModels(browserModels, serverRes.models ?? []),
    status: {
      loading: false,
      ollamaBrowser: browserModels.length > 0,
      ollamaServer: Boolean(serverRes.ollama),
      xai: Boolean(serverRes.xai),
      openai: Boolean(serverRes.openai),
      anthropic: Boolean(serverRes.anthropic),
      kimi: Boolean(serverRes.kimi),
      deepseek: Boolean(serverRes.deepseek),
      error: serverRes.error,
    },
  };
}

export type ChatTurn = {
  role: string;
  content: string;
  images?: string[];
  documents?: { name: string; mime: string; data: string }[];
};

export type ChatRequestBody = {
  provider: ModelRef["provider"];
  transport: "browser" | "server";
  host: string;
  model: string;
  messages: ChatTurn[];
  temperature: number;
  systemPrompt?: string;
  contextLength?: number;
  apiKey?: string;
  accountId?: string;
};

function withSystem(messages: ChatTurn[], systemPrompt?: string): ChatTurn[] {
  if (!systemPrompt?.trim()) return messages;
  return [{ role: "system", content: systemPrompt.trim() }, ...messages];
}

export async function streamChat(
  body: ChatRequestBody,
  onDelta: (text: string) => void,
  signal: AbortSignal,
  onUsage?: (usage: TokenUsage) => void,
) {
  await ensureCloudAuth();
  const messages = withSystem(body.messages, body.systemPrompt);

  if (body.provider === "ollama" && body.transport === "browser") {
    await streamOllamaBrowser(
      {
        host: body.host,
        model: body.model,
        messages,
        temperature: body.temperature,
        contextLength: body.contextLength,
      },
      onDelta,
      signal,
      onUsage,
    );
    return;
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: body.provider,
      host: body.host,
      model: body.model,
      messages,
      temperature: body.temperature,
      contextLength: body.contextLength,
      apiKey: body.apiKey,
      accountId: body.accountId,
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Chat failed (${res.status})`);
  }
  await readSseStream(res, onDelta, onUsage);
}

export async function resetModelContext(
  host: string,
  model: { id: string; provider: ModelRef["provider"]; transport: Transport },
) {
  if (model.provider !== "ollama") return;
  if (model.transport === "browser") {
    await fetch(`${host.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        prompt: "",
        keep_alive: 0,
        stream: false,
      }),
    }).catch(() => undefined);
    return;
  }
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, model: model.id }),
  }).catch(() => undefined);
}

async function streamOllamaBrowser(
  opts: {
    host: string;
    model: string;
    messages: ChatTurn[];
    temperature: number;
    contextLength?: number;
  },
  onDelta: (text: string) => void,
  signal: AbortSignal,
  onUsage?: (usage: TokenUsage) => void,
) {
  const host = opts.host.replace(/\/+$/, "");
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
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Ollama error ${res.status}`);
  }
  if (!res.body) throw new Error("Ollama returned an empty stream");
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
        if (json.message?.content) onDelta(json.message.content);
        const promptTokens = Number(json.prompt_eval_count) || 0;
        const completionTokens = Number(json.eval_count) || 0;
        if (promptTokens || completionTokens) {
          onUsage?.({ promptTokens, completionTokens });
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}

async function readSseStream(
  res: Response,
  onDelta: (text: string) => void,
  onUsage?: (usage: TokenUsage) => void,
) {
  if (!res.body) throw new Error("Empty response");
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
      if (!data) continue;
      try {
        const json = JSON.parse(data) as {
          content?: string;
          error?: string;
          done?: boolean;
          usage?: TokenUsage;
        };
        if (json.error) throw new Error(json.error);
        if (json.content) onDelta(json.content);
        if (json.usage) onUsage?.(json.usage);
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}
