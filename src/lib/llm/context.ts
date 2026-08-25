export function xaiContextLength(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes("4.5") || lower.startsWith("grok-4")) return 256000;
  if (lower.startsWith("grok-3")) return 131072;
  return 128000;
}

/** Official published windows, used only when the model file does not report one. Specific names first. */
const PUBLISHED_CONTEXT: { match: RegExp; tokens: number }[] = [
  { match: /phi-?3-mini-4k/i, tokens: 4096 },
  { match: /phi-?3/i, tokens: 131072 },
  { match: /phi-?4-mini/i, tokens: 131072 },
  { match: /phi-?4/i, tokens: 16384 },
  { match: /llama3\.[23]/i, tokens: 131072 },
  { match: /llama3\.1/i, tokens: 131072 },
  { match: /llama3(\b|:|$)/i, tokens: 8192 },
  { match: /llama2/i, tokens: 4096 },
  { match: /gemma3/i, tokens: 131072 },
  { match: /gemma2/i, tokens: 8192 },
  { match: /gemma(\b|:|$)/i, tokens: 8192 },
  { match: /qwen3-coder/i, tokens: 262144 },
  { match: /qwen3/i, tokens: 40960 },
  { match: /qwen2\.5/i, tokens: 32768 },
  { match: /qwen2/i, tokens: 32768 },
  { match: /mistral-nemo/i, tokens: 128000 },
  { match: /mistral(\b|:|$)/i, tokens: 32768 },
  { match: /mixtral/i, tokens: 32768 },
  { match: /deepseek-r1/i, tokens: 131072 },
  { match: /deepseek-v3/i, tokens: 163840 },
  { match: /deepseek-coder-v2/i, tokens: 163840 },
  { match: /smollm2/i, tokens: 8192 },
  { match: /smollm(\b|:|$)/i, tokens: 2048 },
  { match: /moondream/i, tokens: 2048 },
  { match: /minicpm-v/i, tokens: 8192 },
  { match: /llava/i, tokens: 4096 },
  { match: /codellama/i, tokens: 16384 },
  { match: /codegemma/i, tokens: 8192 },
  { match: /starcoder2/i, tokens: 16384 },
  { match: /command-r/i, tokens: 131072 },
  { match: /tinyllama/i, tokens: 2048 },
  { match: /granite/i, tokens: 8192 },
  { match: /nemotron/i, tokens: 131072 },
];

export type OllamaContextExtra = {
  modelId?: string;
  family?: string;
  parameterSize?: string;
  sizeBytes?: number;
};

export function parseArchitectureContextLength(
  info?: Record<string, unknown>,
): number | undefined {
  if (!info || typeof info !== "object") return undefined;
  for (const [key, value] of Object.entries(info)) {
    if (key.endsWith(".context_length") || key === "context_length") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

export function parseParameterNumCtx(parameters?: string): number | undefined {
  if (typeof parameters !== "string") return undefined;
  const match = parameters.match(/num_ctx\s+(\d+)/i);
  if (!match?.[1]) return undefined;
  const n = Number(match[1]);
  if (Number.isFinite(n) && n > 0) return n;
  return undefined;
}

function modelLookupName(modelId?: string, family?: string): string {
  const raw = (modelId ?? "").trim();
  const base = raw.replace(/^hf\.co\/[^/]+\//i, "").split("/").pop() ?? raw;
  const untagged = base.replace(/:.*$/, "");
  return `${family ?? ""} ${untagged} ${raw}`.trim();
}

/** 128k / 8k / 4k in the model name is that model's window, not a guess. */
export function contextHintFromName(modelId?: string): number | undefined {
  if (!modelId) return undefined;
  const m = modelId.toLowerCase().match(/(?:^|[-_.:/])(128k|64k|32k|16k|8k|4k)(?:$|[-_.:])/i);
  if (!m?.[1]) return undefined;
  const map: Record<string, number> = {
    "128k": 131072,
    "64k": 65536,
    "32k": 32768,
    "16k": 16384,
    "8k": 8192,
    "4k": 4096,
  };
  return map[m[1].toLowerCase()];
}

export function lookupPublishedContext(modelId?: string, family?: string): number | undefined {
  const fromName = contextHintFromName(modelId);
  if (fromName) return fromName;
  const blob = modelLookupName(modelId, family);
  if (!blob) return undefined;
  for (const row of PUBLISHED_CONTEXT) {
    if (row.match.test(blob)) return row.tokens;
  }
  return undefined;
}

function parseParameterCount(parameterSize?: string, sizeBytes?: number): number | undefined {
  if (typeof parameterSize === "string") {
    const m = parameterSize.trim().match(/^([\d.]+)\s*([bmk])\b/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) {
        const unit = m[2].toLowerCase();
        const mul = unit === "b" ? 1e9 : unit === "m" ? 1e6 : 1e3;
        return n * mul;
      }
    }
  }
  if (sizeBytes && sizeBytes > 0) {
    return sizeBytes * 2;
  }
  return undefined;
}

/** Last resort when the model never published a window. */
export function estimateContextFromParameters(
  parameterSize?: string,
  sizeBytes?: number,
): number | undefined {
  const n = parseParameterCount(parameterSize, sizeBytes);
  if (n == null) return undefined;
  if (n <= 4e8) return 2048;
  if (n <= 3e9) return 8192;
  if (n <= 1.5e10) return 8192;
  return 4096;
}

/**
 * Unique context window for this model, checked in order:
 * 1. GGUF / Ollama model_info context_length
 * 2. 128k/8k/… in the model name, or the published window for that name
 * 3. Modelfile num_ctx
 * 4. Estimate from parameter size
 */
export function parseOllamaContextLength(
  body: {
    model_info?: Record<string, unknown>;
    parameters?: string;
  },
  extra?: OllamaContextExtra,
): number | undefined {
  const arch = parseArchitectureContextLength(body.model_info);
  if (arch) return arch;
  const published = lookupPublishedContext(extra?.modelId, extra?.family);
  if (published) return published;
  const numCtx = parseParameterNumCtx(body.parameters);
  if (numCtx) return numCtx;
  return estimateContextFromParameters(extra?.parameterSize, extra?.sizeBytes);
}

export function resolveOllamaNumCtx(contextLength?: number): number | undefined {
  if (contextLength == null || !Number.isFinite(contextLength) || contextLength <= 0) {
    return undefined;
  }
  return Math.round(contextLength);
}

/**
 * First chat matches the terminal: do not send num_ctx. Sending the model's
 * published window (8k–128k) makes Ollama reload and allocate a huge KV cache,
 * which is why a 600ms CLI reply can take 45s here.
 */
export function initialOllamaNumCtx(): number | undefined {
  return undefined;
}

export function nextCtxForOverflow(current: number | undefined, cap?: number): number | undefined {
  const from = current && current > 2048 ? current : 2048;
  const ceiling = cap && Number.isFinite(cap) && cap > 0 ? cap : 32768;
  const next = Math.min(ceiling, Math.max(4096, from * 2));
  return next > from ? next : undefined;
}

export function isOllamaBusyError(message: string): boolean {
  const t = stripOllamaErrorPayload(message).toLowerCase();
  return (
    t.includes("busy") ||
    t.includes("currently loading") ||
    t.includes("loading model") ||
    t.includes("model is loading") ||
    t.includes("runner process")
  );
}

export function ollamaChatOptions(temperature: number, numCtx?: number): Record<string, number> | undefined {
  const options: Record<string, number> = {};
  if (numCtx) options.num_ctx = numCtx;
  void temperature;
  return Object.keys(options).length ? options : undefined;
}

export function busyRetryMs(attempt: number): number {
  return Math.min(2000, 250 * Math.max(1, attempt));
}

export function parseOllamaMemoryBudget(
  message: string,
): { requiredGiB: number; availableGiB: number } | undefined {
  const t = stripOllamaErrorPayload(message);
  const m = t.match(
    /requires more(?:\s+system)?\s+memory\s*\(([\d.]+)\s*GiB\)\s*than is available\s*\(([\d.]+)\s*GiB\)/i,
  );
  if (!m) return undefined;
  const requiredGiB = Number(m[1]);
  const availableGiB = Number(m[2]);
  if (!Number.isFinite(requiredGiB) || !Number.isFinite(availableGiB) || requiredGiB <= 0) {
    return undefined;
  }
  return { requiredGiB, availableGiB };
}

export function nextCtxForMemoryError(current: number, message: string): number | undefined {
  if (!Number.isFinite(current) || current <= 2048) return undefined;
  const budget = parseOllamaMemoryBudget(message);
  if (budget && budget.availableGiB > 0) {
    const ratio = (budget.availableGiB / budget.requiredGiB) * 0.7;
    const scaled = Math.floor((current * ratio) / 256) * 256;
    const next = Math.min(current - 256, Math.max(2048, scaled));
    if (next < current) return next;
  }
  const halved = Math.max(2048, Math.floor(current / 2 / 256) * 256);
  return halved < current ? halved : undefined;
}

export function isOllamaMemoryError(message: string): boolean {
  const t = message.toLowerCase();
  return (
    t.includes("requires more memory") ||
    t.includes("requires more system memory") ||
    t.includes("not enough memory") ||
    t.includes("out of memory") ||
    t.includes("insufficient memory") ||
    t.includes("cuda out of memory") ||
    /\booms?\b/.test(t)
  );
}

export function stripOllamaErrorPayload(message: string): string {
  const trimmed = message.trim();
  const fromJson = (raw: string): string | undefined => {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
      if (parsed?.error && typeof parsed.error === "object") {
        const inner = parsed.error as { message?: unknown };
        if (typeof inner.message === "string" && inner.message.trim()) return inner.message;
      }
    } catch {
      /* not json */
    }
    return undefined;
  };
  const direct = fromJson(trimmed);
  if (direct) return direct;
  const nested = trimmed.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (nested) {
    const inner = fromJson(nested[0]);
    if (inner) return inner;
  }
  return message;
}

const MEMORY_HINT =
  "This model needs more RAM than is free for its full context window. The file on disk can be small while a long window still uses a lot of memory. Ollama_UI read this model's real window for the meter, talks to Ollama like the terminal (no huge window forced on each send), and only shortens the window if Ollama reports it ran out of RAM.";

export function friendlyOllamaError(message: string): string {
  if (message === MEMORY_HINT) return message;
  const stripped = stripOllamaErrorPayload(message);
  if (isOllamaMemoryError(message) || isOllamaMemoryError(stripped)) return MEMORY_HINT;
  return stripped;
}

export function parseOllamaCapabilities(
  body: {
    capabilities?: unknown;
    projector_info?: unknown;
    details?: { family?: string };
  },
  name: string,
): string[] {
  const caps = new Set<string>();
  if (Array.isArray(body.capabilities)) {
    for (const item of body.capabilities) {
      if (typeof item === "string" && item.trim()) caps.add(item.toLowerCase());
    }
  }
  if (body.projector_info) caps.add("vision");
  const blob = `${name} ${body.details?.family ?? ""}`.toLowerCase();
  if (
    /llava|bakllava|moondream|vision|minicpm-v|qwen2(\.5)?-vl|qwen-vl|pixtral|gemma3|llama3\.2-vision/.test(
      blob,
    )
  ) {
    caps.add("vision");
  }
  return [...caps];
}
