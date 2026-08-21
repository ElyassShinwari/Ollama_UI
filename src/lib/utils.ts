import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | undefined): string | null {
  if (bytes == null || Number.isNaN(bytes)) return null;
  if (bytes < 1024 ** 3) return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens < 0) return "0";
  if (tokens < 1000) return String(Math.round(tokens));
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    const text = k >= 10 ? String(Math.round(k)) : k.toFixed(1).replace(/\.0$/, "");
    return `${text}k`;
  }
  const m = tokens / 1_000_000;
  const text = m >= 10 ? String(Math.round(m)) : m.toFixed(1).replace(/\.0$/, "");
  return `${text}M`;
}

export function formatContextWindow(tokens: number | undefined): string | null {
  if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) return null;
  return `${formatTokenCount(tokens)} ctx`;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let n = 0;
  const pieces = text.split(/(\s+)/);
  for (const piece of pieces) {
    if (!piece || /^\s+$/.test(piece)) continue;
    const cjk = piece.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
    if (cjk) n += cjk;
    const rest = piece.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, "");
    if (!rest) continue;
    const bits = rest.split(/([.,!?;:()[\]{}'"“”‘’`])/).filter(Boolean);
    for (const bit of bits) {
      if (bit.length <= 3) n += 1;
      else n += Math.ceil(bit.length / 3.6);
    }
  }
  return Math.max(1, Math.round(n));
}

export function greetingForNow(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function sanitizeOllamaHost(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Host must be http or https");
  }
  return url.origin;
}

export function isContextOverflowError(message: string): boolean {
  const t = message.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("context size") ||
    t.includes("prompt is too long") ||
    t.includes("maximum context") ||
    t.includes("n_keep") ||
    t.includes("exceeds the context") ||
    t.includes("too many tokens")
  );
}
