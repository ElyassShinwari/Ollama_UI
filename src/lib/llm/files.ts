import type { ModelRef } from "@/lib/chat/types";

export type PendingFile = {
  id: string;
  name: string;
  kind: "txt" | "image" | "file";
  ext: string;
  mime?: string;
  text?: string;
  previewUrl?: string;
  base64?: string;
};

export type PendingDocument = {
  name: string;
  mime: string;
  data: string;
};

const TEXT_MAX = 350_000;
const IMAGE_MAX = 12 * 1024 * 1024;
const FILE_MAX = 16 * 1024 * 1024;

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".svg", ".ico", ".avif"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"]);
const TEXT_EXT = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".xml", ".html", ".htm", ".css",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".c", ".h", ".cpp", ".hpp", ".cs", ".php", ".lua", ".r", ".sql", ".sh", ".bash", ".zsh", ".ps1",
  ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".env", ".log", ".diff", ".patch", ".tex",
  ".rst", ".org", ".vue", ".svelte", ".lock", ".gradle", ".properties", ".gitignore",
]);

const VISION_RE =
  /llava|bakllava|moondream|vision|minicpm-v|qwen2(\.5)?-vl|qwen-vl|pixtral|gemma3|llama3\.2-vision|llama4|gpt-4o|gpt-4\.1|gpt-5|claude|grok/;

export function inferCaps(
  model: Pick<ModelRef, "id" | "family" | "capabilities" | "provider">,
): { vision: boolean; audio: boolean; openFiles: boolean } {
  const listed = new Set((model.capabilities ?? []).map((c) => c.toLowerCase()));
  const blob = `${model.id} ${model.family ?? ""}`.toLowerCase();
  const cloud = model.provider !== "ollama";
  return {
    vision: listed.has("vision") || VISION_RE.test(blob) || cloud,
    audio: listed.has("audio") || /whisper|qwen2-audio/.test(blob),
    openFiles: cloud || listed.size === 0 || listed.has("tools") || listed.has("vision"),
  };
}

export function acceptedExtensions(model: Pick<ModelRef, "id" | "family" | "capabilities" | "provider">): string[] {
  const caps = inferCaps(model);
  if (caps.openFiles || model.provider !== "ollama") return [];
  const ext = [...TEXT_EXT];
  if (caps.vision) ext.push(...IMAGE_EXT);
  if (caps.audio) ext.push(...AUDIO_EXT);
  return [...new Set(ext)];
}

export function formatAccepted(exts: string[]): string {
  return exts.join(", ");
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function unsupportedHint(modelName: string, detail: string) {
  return `${modelName}: ${detail}`;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "text/html": ".html",
    "application/json": ".json",
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/heic": ".heic",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
  };
  return map[mime] ?? "";
}

function looksLikeText(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 8192)));
  if (bytes.length === 0) return true;
  let odd = 0;
  for (const b of bytes) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) odd += 1;
  }
  return odd / bytes.length < 0.15;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataFromDataUrl(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function readDroppedFile(file: File): Promise<{ ok: true; file: PendingFile } | { ok: false; reason: string }> {
  const ext = extensionOf(file.name) || mimeToExt(file.type);
  const mime = file.type || "application/octet-stream";

  if (IMAGE_EXT.has(ext) || mime.startsWith("image/")) {
    if (file.size > IMAGE_MAX) {
      return { ok: false, reason: `${file.name} is larger than ${Math.round(IMAGE_MAX / 1024 / 1024)} MB` };
    }
    const dataUrl = await readAsDataUrl(file);
    return {
      ok: true,
      file: {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "image",
        ext,
        mime: mime.startsWith("image/") ? mime : "image/png",
        previewUrl: dataUrl,
        base64: dataFromDataUrl(dataUrl),
      },
    };
  }

  if (TEXT_EXT.has(ext) || mime.startsWith("text/") || mime === "application/json") {
    let text = await file.text();
    if (text.length > TEXT_MAX) text = `${text.slice(0, TEXT_MAX)}\n\n[Truncated ${file.name}]`;
    return {
      ok: true,
      file: { id: crypto.randomUUID(), name: file.name, kind: "txt", ext, mime, text },
    };
  }

  if (file.size > FILE_MAX) {
    return { ok: false, reason: `${file.name} is larger than ${Math.round(FILE_MAX / 1024 / 1024)} MB` };
  }

  const buffer = await file.arrayBuffer();
  if (looksLikeText(buffer)) {
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (text.length > TEXT_MAX) text = `${text.slice(0, TEXT_MAX)}\n\n[Truncated ${file.name}]`;
    return {
      ok: true,
      file: { id: crypto.randomUUID(), name: file.name, kind: "txt", ext, mime, text },
    };
  }

  const dataUrl = await readAsDataUrl(file);
  return {
    ok: true,
    file: {
      id: crypto.randomUUID(),
      name: file.name,
      kind: "file",
      ext,
      mime,
      base64: dataFromDataUrl(dataUrl),
    },
  };
}

export function buildMessageFromFiles(text: string, files: PendingFile[]): {
  content: string;
  images?: string[];
  documents?: PendingDocument[];
  attachments?: { name: string; kind: "txt" | "image" | "file" }[];
} {
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  const images: string[] = [];
  const documents: PendingDocument[] = [];
  for (const file of files) {
    if (file.kind === "txt" && file.text) {
      parts.push(`Attached file: ${file.name}\n${file.text}`);
    } else if (file.kind === "image" && file.base64) {
      const mime = file.mime && file.mime.startsWith("image/") ? file.mime : "image/png";
      images.push(`data:${mime};base64,${file.base64}`);
    } else if (file.kind === "file" && file.base64) {
      documents.push({
        name: file.name,
        mime: file.mime || "application/octet-stream",
        data: file.base64,
      });
      parts.push(`Attached file: ${file.name} (${file.mime || "binary"})`);
    } else {
      parts.push(`Attached file: ${file.name}`);
    }
  }
  if (parts.length === 0) {
    parts.push(images.length || documents.length ? "See the attached file(s)." : "");
  }
  return {
    content: parts.filter(Boolean).join("\n\n"),
    images: images.length ? images : undefined,
    documents: documents.length ? documents : undefined,
    attachments: files.map((f) => ({ name: f.name, kind: f.kind })),
  };
}
