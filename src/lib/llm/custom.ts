import type { CustomEndpoint, ModelRef } from "@/lib/chat/types";

export function sanitizeCompatBase(raw: string): string {
  let text = raw.trim();
  if (!text) throw new Error("Base URL is required");
  if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
  const url = new URL(text);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL must be http or https");
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    path = path.slice(0, -"/chat/completions".length).replace(/\/+$/, "");
  }
  if (path.endsWith("/models")) {
    path = path.slice(0, -"/models".length).replace(/\/+$/, "");
  }
  if (!path || path === "/") path = "/v1";
  else if (!/\/v1$/i.test(path) && !/\/v1\//i.test(path)) path = `${path}/v1`;
  return `${url.origin}${path}`;
}

export function compatChatUrl(base: string): string {
  return `${sanitizeCompatBase(base)}/chat/completions`;
}

export function compatModelsUrl(base: string): string {
  return `${sanitizeCompatBase(base)}/models`;
}

export function parseCompatModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const rec = body as { data?: unknown; models?: unknown };
  const rows = Array.isArray(rec.data) ? rec.data : Array.isArray(rec.models) ? rec.models : [];
  const ids: string[] = [];
  for (const row of rows) {
    if (typeof row === "string" && row.trim()) {
      ids.push(row.trim());
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; name?: unknown };
    const id = typeof item.id === "string" ? item.id : typeof item.name === "string" ? item.name : "";
    if (id.trim()) ids.push(id.trim());
  }
  return ids;
}

export function isCompatChatModel(id: string): boolean {
  const l = id.toLowerCase();
  return !/(embed|whisper|tts|moderation|dall-e|image|audio|realtime|transcribe)/.test(l);
}

export function parseModelList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function customModelId(endpointId: string, remoteId: string): string {
  return `${endpointId}:${remoteId}`;
}

export function remoteIdFromCustom(modelId: string, endpointId: string): string {
  const prefix = `${endpointId}:`;
  return modelId.startsWith(prefix) ? modelId.slice(prefix.length) : modelId;
}

export function customModelRef(endpoint: CustomEndpoint, remoteId: string): ModelRef {
  const name = endpoint.name.trim();
  return {
    id: customModelId(endpoint.id, remoteId),
    name: name ? `${name} · ${remoteId}` : remoteId,
    provider: "custom",
    transport: "server",
    family: endpoint.id,
  };
}

export function modelsFromCustomEndpoints(endpoints: CustomEndpoint[] | undefined): ModelRef[] {
  if (!endpoints?.length) return [];
  const out: ModelRef[] = [];
  const seen = new Set<string>();
  for (const endpoint of endpoints) {
    for (const remoteId of endpoint.models) {
      if (!remoteId) continue;
      const ref = customModelRef(endpoint, remoteId);
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      out.push(ref);
    }
  }
  return out;
}

export function endpointForModel(
  endpoints: CustomEndpoint[] | undefined,
  model: Pick<ModelRef, "provider" | "id" | "family">,
): CustomEndpoint | undefined {
  if (model.provider !== "custom" || !endpoints?.length) return undefined;
  if (model.family) {
    const hit = endpoints.find((e) => e.id === model.family);
    if (hit) return hit;
  }
  return endpoints.find((e) => model.id.startsWith(`${e.id}:`));
}
