export function xaiContextLength(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes("4.5") || lower.startsWith("grok-4")) return 256000;
  if (lower.startsWith("grok-3")) return 131072;
  return 128000;
}

export function parseOllamaContextLength(body: {
  model_info?: Record<string, unknown>;
  parameters?: string;
}): number | undefined {
  const info = body.model_info;
  if (info && typeof info === "object") {
    for (const [key, value] of Object.entries(info)) {
      if (key.endsWith(".context_length") || key === "context_length") {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  if (typeof body.parameters === "string") {
    const match = body.parameters.match(/num_ctx\s+(\d+)/i);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
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
