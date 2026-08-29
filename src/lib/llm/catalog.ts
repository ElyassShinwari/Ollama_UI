import {
  busyRetryMs,
  friendlyOllamaError,
  initialOllamaNumCtx,
  isOllamaBusyError,
  isOllamaMemoryError,
  lookupPublishedContext,
  nextCtxForMemoryError,
  nextCtxForOverflow,
  ollamaChatOptions,
  parseOllamaCapabilities,
  parseOllamaContextLength,
  estimateContextFromParameters,
  xaiContextLength,
} from "@/lib/llm/context";
import { cloudSecret } from "@/lib/llm/cloud";
import { ensureCloudAuth } from "@/lib/llm/oauth-client";
import {
  isOllamaUnreachable,
  loadedOllamaNames,
  modelsToUnload,
  ollamaChatPayload,
  ollamaGate,
  streamOllamaDirect,
} from "@/lib/llm/ollama-client";
import { useChatStore } from "@/lib/chat/store";
import { setChatLane } from "@/lib/studio/lane";
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
  void host;
  return models.map((model) => {
    if (model.contextLength) return model;
    const fallback =
      lookupPublishedContext(model.id, model.family) ??
      estimateContextFromParameters(model.parameterSize, model.size);
    return fallback ? { ...model, contextLength: fallback } : model;
  });
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

export async function fillOllamaContext(host: string, model: ModelRef): Promise<ModelRef> {
  if (model.provider !== "ollama" || ollamaGate.chat) return model;
  try {
    const res = await fetch(`${host.replace(/\/+$/, "")}/api/show`, {
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
    const contextLength =
      parseOllamaContextLength(body, {
        modelId: model.id,
        family: model.family,
        parameterSize: model.parameterSize,
        sizeBytes: model.size,
      }) ?? model.contextLength;
    const capabilities = parseOllamaCapabilities(body, model.id);
    return {
      ...model,
      contextLength: contextLength ?? model.contextLength,
      capabilities: capabilities.length ? capabilities : model.capabilities,
    };
  } catch {
    return model;
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
  const s = useChatStore.getState().settings;
  const headers: Record<string, string> = {};
  const openai = cloudSecret(s, "openai") || keys.openai;
  const anthropic = cloudSecret(s, "anthropic") || keys.anthropic;
  const xai = cloudSecret(s, "xai") || keys.xai;
  const kimi = cloudSecret(s, "kimi") || keys.kimi;
  const deepseek = cloudSecret(s, "deepseek") || keys.deepseek;
  if (openai) headers["x-openai-key"] = openai;
  if (anthropic) headers["x-anthropic-key"] = anthropic;
  if (xai) headers["x-xai-key"] = xai;
  if (kimi) headers["x-kimi-key"] = kimi;
  if (deepseek) headers["x-deepseek-key"] = deepseek;
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
  modelSize?: number;
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
  if (body.provider !== "ollama") await ensureCloudAuth();
  const settings = useChatStore.getState().settings;
  const apiKey = cloudSecret(settings, body.provider) || body.apiKey;
  const accountId =
    body.provider === "openai"
      ? settings.openaiOAuth?.accountId || body.accountId
      : body.accountId;
  const messages = withSystem(body.messages, body.systemPrompt);

  if (body.provider === "ollama") {
    ollamaGate.chat = true;
    setChatLane(true);
    try {
      await streamOllamaBrowser(
        {
          host: body.host,
          model: body.model,
          messages,
          temperature: body.temperature,
          contextLength: body.contextLength,
          modelSize: body.modelSize,
        },
        onDelta,
        signal,
        onUsage,
      );
      return;
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") throw err;
      if (!isOllamaUnreachable(err)) throw err;
    } finally {
      ollamaGate.chat = false;
      setChatLane(false);
    }
    ollamaGate.chat = true;
    setChatLane(true);
  }

  try {
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
        modelSize: body.modelSize,
        apiKey,
        accountId,
      }),
      signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Chat failed (${res.status})`);
    }
    await readSseStream(res, onDelta, onUsage);
  } finally {
    if (body.provider === "ollama") {
      ollamaGate.chat = false;
      setChatLane(false);
    }
  }
}

let releaseTail: Promise<void> = Promise.resolve();

export function pendingOllamaRelease() {
  return releaseTail;
}

/** Drop every loaded Ollama runner except `keep`, so a switch cannot pin two models in RAM. */
export function releaseLoadedOllama(host: string, keep?: string, extra: string[] = []) {
  releaseTail = releaseTail.then(() => dropLoadedOllama(host, keep, extra)).catch(() => undefined);
  return releaseTail;
}

async function dropLoadedOllama(host: string, keep?: string, extra: string[] = []) {
  const base = host.replace(/\/+$/, "");
  let loaded: string[] = [];
  let fromPs = false;
  try {
    const res = await fetch(`${base}/api/ps`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      loaded = loadedOllamaNames(await res.json());
      fromPs = true;
    }
  } catch {
    loaded = [];
  }
  const names = modelsToUnload(fromPs ? loaded : extra, keep);
  await Promise.all(names.map((name) => unloadOllamaBrowser(base, name)));
}

export function adoptModel(model: ModelRef) {
  const prev = useChatStore.getState().selectedModel;
  const host = useChatStore.getState().settings.ollamaHost;
  const same = Boolean(prev && prev.id === model.id && prev.provider === model.provider);
  useChatStore.getState().setSelectedModel(model);
  if (same) return;
  if (prev?.provider === "ollama" || model.provider === "ollama") {
    void releaseLoadedOllama(
      host,
      model.provider === "ollama" ? model.id : undefined,
      prev?.provider === "ollama" ? [prev.id] : [],
    );
  }
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

async function unloadOllamaBrowser(host: string, model: string) {
  await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "",
      keep_alive: 0,
      stream: false,
    }),
    signal: AbortSignal.timeout(12000),
  }).catch(() => undefined);
}

async function streamOllamaBrowser(
  opts: {
    host: string;
    model: string;
    messages: ChatTurn[];
    temperature: number;
    contextLength?: number;
    modelSize?: number;
  },
  onDelta: (text: string) => void,
  signal: AbortSignal,
  onUsage?: (usage: TokenUsage) => void,
) {
  const host = opts.host.replace(/\/+$/, "");
  await pendingOllamaRelease();
  let numCtx = initialOllamaNumCtx();
  let lastMessage = "Ollama failed";
  let busyTries = 0;
  while (true) {
    const options = ollamaChatOptions(opts.temperature, numCtx);
    const payload = ollamaChatPayload(
      opts.model,
      opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images,
      })),
      options,
    );
    let produced = false;
    try {
      await streamOllamaDirect({
        url: `${host}/api/chat`,
        payload,
        signal,
        onDelta: (text) => {
          produced = true;
          onDelta(text);
        },
        onUsage,
      });
      return;
    } catch (err) {
      if (signal.aborted || (err as { name?: string }).name === "AbortError") throw err;
      lastMessage = err instanceof Error ? err.message : String(err);
      if (!produced && isOllamaBusyError(lastMessage) && busyTries < 4) {
        busyTries += 1;
        await new Promise((r) => setTimeout(r, busyRetryMs(busyTries)));
        continue;
      }
      if (!produced && isOllamaMemoryError(lastMessage)) {
        const next = nextCtxForMemoryError(numCtx ?? 8192, lastMessage);
        if (next) {
          numCtx = next;
          await unloadOllamaBrowser(host, opts.model);
          continue;
        }
      }
      if (!produced && isOverflow(lastMessage)) {
        const next = nextCtxForOverflow(numCtx, opts.contextLength);
        if (next) {
          numCtx = next;
          continue;
        }
      }
      throw isOllamaUnreachable(err) ? err : new Error(friendlyOllamaError(lastMessage));
    }
  }
}

function isOverflow(message: string) {
  const t = message.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("context size") ||
    t.includes("prompt is too long") ||
    t.includes("maximum context") ||
    t.includes("exceeds the context") ||
    t.includes("too many tokens")
  );
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
