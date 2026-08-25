import { CHATGPT_OAUTH_MODELS, FALLBACK_CLOUD, cloudEndpoint, extraCloudHeaders, isChatGptOAuth, isGrokCliVersionError, responsesTextType, type CloudId } from "@/lib/llm/cloud";
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
import { ollamaChatPayload } from "@/lib/llm/ollama-client";
import { sanitizeOllamaHost } from "@/lib/utils";
import type { ModelRef, TokenUsage } from "@/lib/chat/types";
import http from "node:http";
import https from "node:https";

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

type ChatTurnIn = {
  role: string;
  content: string;
  images?: string[];
  documents?: { name: string; mime: string; data: string }[];
};

function asDataUrl(value: string, fallbackMime: string) {
  if (value.startsWith("data:")) return value;
  return `data:${fallbackMime};base64,${value}`;
}

function rawBase64(value: string) {
  if (!value.startsWith("data:")) return value;
  const comma = value.indexOf(",");
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function mimeFromDataUrl(value: string, fallback: string) {
  const match = /^data:([^;]+);/i.exec(value);
  return match?.[1] || fallback;
}

function toOpenAiContent(m: ChatTurnIn) {
  if (!m.images?.length) return m.content;
  const parts: Record<string, unknown>[] = [];
  if (m.content.trim()) parts.push({ type: "text", text: m.content });
  for (const img of m.images ?? []) {
    parts.push({ type: "image_url", image_url: { url: asDataUrl(img, "image/png") } });
  }
  return parts;
}

function hasDocuments(messages: ChatTurnIn[]) {
  return messages.some((m) => m.documents?.some((d) => Boolean(d.data)));
}

async function uploadProviderFile(
  filesUrl: string,
  apiKey: string,
  doc: { name: string; mime: string; data: string },
  purpose: string,
  extraHeaders?: Record<string, string>,
) {
  if (!doc.data) throw new Error(`${doc.name} has no file data to upload`);
  const bytes = Buffer.from(doc.data, "base64");
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: doc.mime || "application/octet-stream" }), doc.name);
  const res = await fetch(filesUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not upload ${doc.name}`);
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error(`Upload of ${doc.name} did not return a file id`);
  return body.id;
}

async function toResponsesInput(opts: {
  messages: ChatTurnIn[];
  filesUrl: string;
  apiKey: string;
  purpose: string;
  extraHeaders?: Record<string, string>;
}) {
  const input: Record<string, unknown>[] = [];
  for (const m of opts.messages) {
    if (m.role === "system") continue;
    const isAssistant = m.role === "assistant";
    const textType = responsesTextType(m.role);
    const content: Record<string, unknown>[] = [];
    if (m.content.trim()) content.push({ type: textType, text: m.content });
    if (!isAssistant) {
      for (const img of m.images ?? []) {
        content.push({ type: "input_image", image_url: asDataUrl(img, "image/png") });
      }
      for (const doc of m.documents ?? []) {
        if (!doc.data) continue;
        const fileId = await uploadProviderFile(opts.filesUrl, opts.apiKey, doc, opts.purpose, opts.extraHeaders);
        content.push({ type: "input_file", file_id: fileId });
      }
    }
    input.push({
      type: "message",
      role: isAssistant ? "assistant" : "user",
      content: content.length ? content : [{ type: textType, text: "" }],
    });
  }
  return input;
}

export async function* streamResponsesApi(opts: {
  url: string;
  filesUrl: string;
  apiKey: string;
  model: string;
  messages: ChatTurnIn[];
  temperature?: number;
  signal: AbortSignal;
  extraHeaders?: Record<string, string>;
  purpose?: string;
}): AsyncGenerator<ChatStreamEvent> {
  const instructions = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n")
    .trim();
  const input = await toResponsesInput({
    messages: opts.messages,
    filesUrl: opts.filesUrl,
    apiKey: opts.apiKey,
    purpose: opts.purpose || "assistants",
    extraHeaders: opts.extraHeaders,
  });
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model: opts.model,
      input,
      stream: true,
      store: false,
      ...(instructions ? { instructions } : {}),
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(fileError(text, res.status, "Responses error"));
  }
  if (!res.body) throw new Error("Empty stream");
  yield* readCodexSse(res.body);
}

function responsesUrls(chatUrl: string) {
  if (chatUrl.includes("api.x.ai")) {
    return { url: "https://api.x.ai/v1/responses", filesUrl: "https://api.x.ai/v1/files", purpose: "assistants" };
  }
  if (chatUrl.includes("api.openai.com")) {
    return { url: "https://api.openai.com/v1/responses", filesUrl: "https://api.openai.com/v1/files", purpose: "user_data" };
  }
  return null;
}

function toAnthropicContent(m: ChatTurnIn) {
  const hasMedia = Boolean(m.images?.length || m.documents?.length);
  if (!hasMedia) return m.content;
  const parts: Record<string, unknown>[] = [];
  if (m.content.trim()) parts.push({ type: "text", text: m.content });
  for (const img of m.images ?? []) {
    parts.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeFromDataUrl(img, "image/png"),
        data: rawBase64(img),
      },
    });
  }
  for (const doc of m.documents ?? []) {
    if (doc.mime === "application/pdf" || doc.name.toLowerCase().endsWith(".pdf")) {
      parts.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: doc.data },
      });
    } else {
      parts.push({ type: "text", text: `Attached file: ${doc.name} (${doc.mime})` });
    }
  }
  return parts;
}

function fileError(text: string, status: number, fallback: string) {
  if (isGrokCliVersionError(text)) {
    return "Grok could not start that reply. Open Studio → Cloud base, sign out of Grok, Sign in again, then send once more.";
  }
  if (/unsupported|invalid.*file|file type|media type|image|document|mime/i.test(text)) {
    return text || "This model did not accept that file.";
  }
  return text || `${fallback} ${status}`;
}

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
  extra?: { sizeBytes?: number; family?: string; parameterSize?: string },
): Promise<{ contextLength?: number; capabilities?: string[] } | undefined> {
  try {
    const res = await fetch(`${host}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(2500),
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
      contextLength: parseOllamaContextLength(body, {
        modelId: name,
        family: extra?.family ?? body.details?.family,
        parameterSize: extra?.parameterSize,
        sizeBytes: extra?.sizeBytes,
      }),
      capabilities: parseOllamaCapabilities(body, name),
    };
  } catch {
    return undefined;
  }
}

export async function listOllamaModels(hostRaw: string): Promise<ModelRef[]> {
  const host = sanitizeOllamaHost(hostRaw);
  const res = await fetch(`${host}/api/tags`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`);
  }
  const body = (await res.json()) as { models?: OllamaTag[] };
  return (body.models ?? []).map((m) => {
    const contextLength =
      lookupPublishedContext(m.name, m.details?.family) ??
      estimateContextFromParameters(m.details?.parameter_size, m.size);
    return {
      id: m.name,
      name: m.name,
      provider: "ollama" as const,
      transport: "server" as const,
      size: m.size,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
      ...(contextLength ? { contextLength } : {}),
    };
  });
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
  modelSize?: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const host = sanitizeOllamaHost(opts.host);
  let numCtx = initialOllamaNumCtx();
  let busyTries = 0;
  while (true) {
    const options = ollamaChatOptions(opts.temperature, numCtx);
    const payload = ollamaChatPayload(opts.model, opts.messages, options);
    let produced = false;
    try {
      const { status, stream } = await postOllamaChat(host, payload, opts.signal);
      if (status >= 400) {
        const text = await new Response(stream).text();
        throw new Error(text || `Ollama error ${status}`);
      }
      for await (const event of readOllamaNdjson(stream)) {
        if (event.content) produced = true;
        yield event;
      }
      return;
    } catch (err) {
      if (opts.signal.aborted) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (!produced && isOllamaBusyError(message) && busyTries < 4) {
        busyTries += 1;
        await new Promise((r) => setTimeout(r, busyRetryMs(busyTries)));
        continue;
      }
      const wrapped = new Error(friendlyOllamaError(message));
      if (produced) throw wrapped;
      if (isOllamaMemoryError(message)) {
        const next = nextCtxForMemoryError(numCtx ?? 8192, message);
        if (next) {
          numCtx = next;
          await unloadOllamaModel(host, opts.model).catch(() => undefined);
          continue;
        }
      }
      if (isOverflowMessage(message)) {
        const next = nextCtxForOverflow(numCtx, opts.contextLength);
        if (next) {
          numCtx = next;
          continue;
        }
      }
      throw wrapped;
    }
  }
}

function postOllamaChat(
  host: string,
  payload: unknown,
  signal: AbortSignal,
): Promise<{ status: number; stream: ReadableStream<Uint8Array> }> {
  const url = new URL("/api/chat", host.endsWith("/") ? host : `${host}/`);
  const lib = url.protocol === "https:" ? https : http;
  const raw = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
          "Content-Length": Buffer.byteLength(raw),
        },
      },
      (res) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            res.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
            res.on("end", () => controller.close());
            res.on("error", (err) => controller.error(err));
          },
          cancel() {
            res.destroy();
          },
        });
        resolve({ status: res.statusCode ?? 0, stream });
      },
    );
    req.on("error", reject);
    const onAbort = () => {
      req.destroy();
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    req.write(raw);
    req.end();
  });
}

function isOverflowMessage(message: string) {
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

export async function* streamXaiChat(opts: {
  model: string;
  messages: ChatTurnIn[];
  temperature: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Cloud models are not available in this environment");
  if (hasDocuments(opts.messages)) {
    yield* streamResponsesApi({
      url: "https://api.x.ai/v1/responses",
      filesUrl: "https://api.x.ai/v1/files",
      apiKey,
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      signal: opts.signal,
      purpose: "assistants",
    });
    return;
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages.map((m) => ({ role: m.role, content: toOpenAiContent(m) })),
      temperature: opts.temperature,
      stream: true,
      max_tokens: 4096,
      stream_options: { include_usage: true },
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(fileError(text, res.status, "xAI error"));
  }
  if (!res.body) throw new Error("xAI returned an empty stream");
  yield* readXaiSse(res.body);
}

export async function listCloudModels(
  provider: CloudId,
  apiKey: string,
): Promise<ModelRef[]> {
  if (!apiKey.trim()) return [];
  if (provider === "openai" && isChatGptOAuth(apiKey)) return CHATGPT_OAUTH_MODELS;
  const fallback = FALLBACK_CLOUD[provider];
  try {
    const ep = cloudEndpoint(provider, apiKey);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      ...extraCloudHeaders(provider, apiKey),
    };
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

function chatgptAccountId(token: string, fallback?: string) {
  if (fallback?.trim()) return fallback.trim();
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((part.length * 3) % 4);
    const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
    if (typeof claims.chatgpt_account_id === "string") return claims.chatgpt_account_id;
    const auth = claims["https://api.openai.com/auth"];
    if (auth && typeof auth === "object" && typeof (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id === "string") {
      return (auth as { chatgpt_account_id: string }).chatgpt_account_id;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function mapCodexModel(id: string) {
  if (/gpt-5|codex|chatgpt/i.test(id) && !/^gpt-4/.test(id)) return id;
  return "gpt-5.4";
}

export async function* streamCodexChat(opts: {
  apiKey: string;
  accountId?: string;
  model: string;
  messages: ChatTurnIn[];
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const accountId = chatgptAccountId(opts.apiKey, opts.accountId);
  const input = opts.messages.map((m) => {
    const isAssistant = m.role === "assistant";
    const hasMedia = !isAssistant && Boolean(m.images?.length || m.documents?.some((d) => d.data));
    if (!hasMedia) {
      return {
        type: "message",
        role: m.role === "system" ? "developer" : m.role,
        content: m.content,
      };
    }
    const content: Record<string, unknown>[] = [];
    if (m.content.trim()) content.push({ type: "input_text", text: m.content });
    for (const img of m.images ?? []) {
      content.push({ type: "input_image", image_url: asDataUrl(img, "image/png") });
    }
    for (const doc of m.documents ?? []) {
      if (!doc.data) continue;
      content.push({
        type: "input_file",
        filename: doc.name,
        file_data: `data:${doc.mime};base64,${doc.data}`,
      });
    }
    return {
      type: "message",
      role: m.role === "system" ? "developer" : m.role,
      content: content.length ? content : [{ type: "input_text", text: "" }],
    };
  });
  const res = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      ...(accountId ? { "ChatGPT-Account-ID": accountId } : {}),
      originator: "codex_cli_rs",
      "User-Agent": "codex_cli_rs/0.144.0",
      version: "0.144.0",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: mapCodexModel(opts.model),
      input,
      stream: true,
      store: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (/insufficient_quota|exceeded your current quota/i.test(text)) {
      throw new Error(
        "That request hit the paid OpenAI API instead of your ChatGPT plan. Sign out and Sign in again under Cloud base, then pick a ChatGPT model.",
      );
    }
    throw new Error(fileError(text, res.status, "ChatGPT error"));
  }
  if (!res.body) throw new Error("ChatGPT returned an empty stream");
  yield* readCodexSse(res.body);
}

async function* readCodexSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
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
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          type?: string;
          delta?: unknown;
          text?: string;
          response?: { usage?: { input_tokens?: number; output_tokens?: number } };
        };
        const type = json.type || "";
        if (type === "response.output_text.delta" || type.endsWith("output_text.delta")) {
          const delta = json.delta;
          const text =
            typeof delta === "string"
              ? delta
              : delta && typeof delta === "object" && typeof (delta as { text?: unknown }).text === "string"
                ? (delta as { text: string }).text
                : typeof json.text === "string"
                  ? json.text
                  : "";
          if (text) yield { content: text };
        }
        const usage = json.response?.usage;
        if (usage && (type === "response.completed" || type === "response.done")) {
          yield {
            usage: {
              promptTokens: Number(usage.input_tokens) || 0,
              completionTokens: Number(usage.output_tokens) || 0,
            },
          };
        }
      } catch {
        /* skip malformed */
      }
    }
  }
}

export async function* streamOpenAiCompat(opts: {
  url: string;
  apiKey: string;
  model: string;
  messages: ChatTurnIn[];
  temperature: number;
  signal: AbortSignal;
  extraHeaders?: Record<string, string>;
}): AsyncGenerator<ChatStreamEvent> {
  const viaResponses = hasDocuments(opts.messages) ? responsesUrls(opts.url) : null;
  if (viaResponses) {
    yield* streamResponsesApi({
      url: viaResponses.url,
      filesUrl: viaResponses.filesUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      signal: opts.signal,
      extraHeaders: opts.extraHeaders,
      purpose: viaResponses.purpose,
    });
    return;
  }
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages.map((m) => ({ role: m.role, content: toOpenAiContent(m) })),
      temperature: opts.temperature,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (/insufficient_quota|exceeded your current quota/i.test(text)) {
      throw new Error(
        "This is the paid OpenAI API, not your ChatGPT plan. Sign in with ChatGPT under Cloud base (no API key) to use the subscription, or add billing at platform.openai.com.",
      );
    }
    throw new Error(fileError(text, res.status, "Cloud error"));
  }
  if (!res.body) throw new Error("Empty stream");
  yield* readXaiSse(res.body);
}

export async function* streamAnthropicChat(opts: {
  apiKey: string;
  model: string;
  messages: ChatTurnIn[];
  temperature: number;
  signal: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const messages = opts.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: toAnthropicContent(m) }));
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
    throw new Error(fileError(text, res.status, "Anthropic error"));
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
    if (value) buf += dec.decode(value, { stream: true });
    if (done) buf += dec.decode();
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    const batch = done && buf.trim() ? parts.concat(buf) : parts;
    if (done) buf = "";
    for (const line of batch) {
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
    if (done) return;
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
