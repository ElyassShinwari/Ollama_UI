import type { ModelRef } from "@/lib/chat/types";

export type PendingFile = {
  id: string;
  name: string;
  kind: "txt" | "image";
  ext: string;
  text?: string;
  previewUrl?: string;
  base64?: string;
};

const TEXT_MAX = 350_000;
const IMAGE_MAX = 4 * 1024 * 1024;

const VISION_RE =
  /llava|bakllava|moondream|vision|minicpm-v|qwen2(\.5)?-vl|qwen-vl|pixtral|gemma3|llama3\.2-vision|llama4/;

export function inferCaps(
  model: Pick<ModelRef, "id" | "family" | "capabilities">,
): { vision: boolean; audio: boolean } {
  const listed = new Set((model.capabilities ?? []).map((c) => c.toLowerCase()));
  const blob = `${model.id} ${model.family ?? ""}`.toLowerCase();
  return {
    vision: listed.has("vision") || VISION_RE.test(blob),
    audio: listed.has("audio") || /whisper|qwen2-audio/.test(blob),
  };
}

export function acceptedExtensions(model: Pick<ModelRef, "id" | "family" | "capabilities">): string[] {
  const caps = inferCaps(model);
  const ext = [".txt"];
  if (caps.vision) ext.push(".png", ".jpg", ".jpeg", ".webp", ".gif");
  if (caps.audio) ext.push(".mp3", ".wav", ".ogg", ".m4a", ".flac");
  return ext;
}

export function formatAccepted(exts: string[]): string {
  return exts.join(", ");
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function unsupportedHint(modelName: string, model: Pick<ModelRef, "id" | "family" | "capabilities">) {
  return `This model (${modelName}) only supports ${formatAccepted(acceptedExtensions(model))}`;
}

export async function readDroppedFile(
  file: File,
  model: Pick<ModelRef, "id" | "family" | "capabilities">,
): Promise<{ ok: true; file: PendingFile } | { ok: false }> {
  const ext = extensionOf(file.name) || mimeToExt(file.type);
  const allowed = acceptedExtensions(model);
  if (!allowed.includes(ext)) return { ok: false };

  if (ext === ".txt") {
    let text = await file.text();
    if (text.length > TEXT_MAX) {
      text = `${text.slice(0, TEXT_MAX)}\n\n[Truncated ${file.name}]`;
    }
    return {
      ok: true,
      file: {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "txt",
        ext,
        text,
      },
    };
  }

  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    if (file.size > IMAGE_MAX) return { ok: false };
    const dataUrl = await readAsDataUrl(file);
    const comma = dataUrl.indexOf(",");
    return {
      ok: true,
      file: {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "image",
        ext,
        previewUrl: dataUrl,
        base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      },
    };
  }

  return { ok: false };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "text/plain": ".txt",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime] ?? "";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function buildMessageFromFiles(text: string, files: PendingFile[]): {
  content: string;
  images?: string[];
  attachments?: { name: string; kind: "txt" | "image" }[];
} {
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  for (const file of files) {
    if (file.kind === "txt" && file.text) {
      parts.push(`Attached file: ${file.name}\n${file.text}`);
    }
  }
  const images = files.filter((f) => f.kind === "image" && f.base64).map((f) => f.base64!);
  if (parts.length === 0) {
    parts.push(images.length ? "Describe the attached image(s)." : "See the attached file(s).");
  }
  return {
    content: parts.join("\n\n"),
    images: images.length ? images : undefined,
    attachments: files.map((f) => ({ name: f.name, kind: f.kind })),
  };
}
