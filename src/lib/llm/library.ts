export type LibraryModel = {
  name: string;
  description: string;
  tags: string[];
  pulls?: string;
};

export const STARTER_MODELS: LibraryModel[] = [
  {
    name: "smollm2",
    description: "Tiny model that runs on almost any computer. Start with 135m or 360m.",
    tags: ["135m", "360m", "1.7b"],
  },
  {
    name: "llama3.2",
    description: "Meta's small Llama 3.2 models. 1b and 3b are laptop-friendly.",
    tags: ["1b", "3b"],
  },
  {
    name: "qwen2.5",
    description: "Strong small Qwen models, including 0.5b and 1.5b.",
    tags: ["0.5b", "1.5b", "3b", "7b"],
  },
  {
    name: "phi3",
    description: "Microsoft Phi-3 mini. Good quality for the size.",
    tags: ["mini", "3.8b"],
  },
  {
    name: "gemma2",
    description: "Google Gemma 2. The 2b tag is a solid small default.",
    tags: ["2b", "9b"],
  },
  {
    name: "moondream",
    description: "Very small vision model for images.",
    tags: ["latest"],
  },
];

export function pullIdsFor(model: LibraryModel): string[] {
  const tags = model.tags.length ? model.tags : ["latest"];
  const ids = tags.map((tag) => (tag === "latest" ? model.name : `${model.name}:${tag}`));
  return [...new Set(ids)];
}

export function sameOllamaId(a: string, b: string) {
  const n = (id: string) => (id.endsWith(":latest") ? id.slice(0, -7) : id);
  return a === b || n(a) === n(b);
}

export function filterLibrary(models: LibraryModel[], query: string): LibraryModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  return models.filter((m) => {
    const blob = `${m.name} ${m.description} ${m.tags.join(" ")}`.toLowerCase();
    return blob.includes(q) || q.startsWith(m.name.toLowerCase());
  });
}

export function parseLibraryHtml(html: string): LibraryModel[] {
  const found = new Map<string, LibraryModel>();
  const re = /href="\/library\/([^"?#]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = decodeURIComponent(match[1] ?? "").trim();
    if (!raw || raw.includes("/")) continue;
    const name = raw.toLowerCase();
    if (!found.has(name)) {
      found.set(name, { name, description: "", tags: [] });
    }
  }
  const tagRe = />(\d+(\.\d+)?[bmk]|mini|small|latest|instruct|vision|tools)</gi;
  for (const model of found.values()) {
    const idx = html.toLowerCase().indexOf(`/library/${model.name}`);
    if (idx < 0) continue;
    const slice = html.slice(idx, idx + 1200);
    const tags = new Set<string>();
    let t: RegExpExecArray | null;
    const local = new RegExp(tagRe);
    while ((t = local.exec(slice))) {
      const tag = t[1]!.toLowerCase();
      if (tag === "tools" || tag === "vision") continue;
      tags.add(tag);
    }
    model.tags = [...tags].slice(0, 8);
    const desc = slice.match(/<p[^>]*>([^<]{20,180})<\/p>/i);
    if (desc?.[1]) model.description = desc[1].replace(/\s+/g, " ").trim();
  }
  return [...found.values()];
}

export function mergeLibrary(primary: LibraryModel[], extra: LibraryModel[]): LibraryModel[] {
  const map = new Map<string, LibraryModel>();
  for (const item of [...primary, ...extra]) {
    const key = item.name.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item, tags: [...new Set(item.tags)] });
      continue;
    }
    map.set(key, {
      name: prev.name,
      description: prev.description || item.description,
      tags: [...new Set([...prev.tags, ...item.tags])],
      pulls: prev.pulls || item.pulls,
    });
  }
  return [...map.values()];
}

export function exactQueryModel(query: string): LibraryModel | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (!/^[a-z0-9._:-]+$/.test(q)) return null;
  const [name, tag] = q.split(":");
  if (!name) return null;
  return {
    name,
    description: tag ? `Install ${q}` : `Install ${name} from the Ollama library`,
    tags: tag ? [tag] : [],
  };
}
