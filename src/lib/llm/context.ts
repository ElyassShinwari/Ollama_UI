export function xaiContextLength(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes("4.5") || lower.startsWith("grok-4")) return 256000;
  if (lower.startsWith("grok-3")) return 131072;
  return 128000;
}

const GiB = 1024 ** 3;

/** Working context the machine can actually hold — not the architecture maximum. */
export function ramSafeCtxCap(sizeBytes?: number): number {
  if (sizeBytes == null || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return 8192;
  if (sizeBytes <= 2.8 * GiB) return 4096;
  if (sizeBytes <= 5.5 * GiB) return 8192;
  if (sizeBytes <= 12 * GiB) return 16384;
  return 32768;
}

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

export function ollamaWorkingContext(opts: {
  architecture?: number;
  parameterNumCtx?: number;
  sizeBytes?: number;
}): number | undefined {
  const cap = ramSafeCtxCap(opts.sizeBytes);
  const param =
    opts.parameterNumCtx && opts.parameterNumCtx > 0 ? opts.parameterNumCtx : undefined;
  const arch = opts.architecture && opts.architecture > 0 ? opts.architecture : undefined;
  const hardMax = arch ?? param;
  if (param) {
    const n = Math.min(param, cap, hardMax ?? param);
    return n > 0 ? n : undefined;
  }
  if (arch) {
    const unknownSize = opts.sizeBytes == null || opts.sizeBytes <= 0;
    const ceiling = unknownSize && arch >= 65536 ? 4096 : cap;
    return Math.min(arch, ceiling);
  }
  return undefined;
}

export function parseOllamaContextLength(
  body: {
    model_info?: Record<string, unknown>;
    parameters?: string;
  },
  sizeBytes?: number,
): number | undefined {
  return ollamaWorkingContext({
    architecture: parseArchitectureContextLength(body.model_info),
    parameterNumCtx: parseParameterNumCtx(body.parameters),
    sizeBytes,
  });
}

export function capOllamaNumCtx(
  requested: number | undefined,
  sizeBytes?: number,
): number {
  const cap = ramSafeCtxCap(sizeBytes);
  if (requested == null || !Number.isFinite(requested) || requested <= 0) return cap;
  return Math.max(512, Math.min(requested, cap));
}

export function nextSmallerOllamaCtx(current: number): number | undefined {
  const ladder = [32768, 16384, 8192, 4096, 2048];
  for (const step of ladder) {
    if (step < current) return step;
  }
  return undefined;
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
  "This model needs more RAM than is free right now. A small file on disk (Phi-3 3.8B is about 2 GB) can still use tens of gigabytes if the full 128k context window is loaded. Ollama_UI uses a smaller working window and retries if memory is still tight. Close other loaded models, free RAM, or pick a smaller model.";

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
