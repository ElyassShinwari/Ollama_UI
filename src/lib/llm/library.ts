export type LibrarySource = "ollama" | "huggingface" | "url";

export type LibraryModel = {
  name: string;
  description: string;
  tags: string[];
  pulls?: string;
  source?: LibrarySource;
  repo?: string;
  pullId?: string;
};

export const STARTER_MODELS: LibraryModel[] = [
  {
    name: "smollm2",
    description: "Tiny model that runs on almost any computer. Start with 135m or 360m.",
    tags: ["135m", "360m", "1.7b"],
    source: "ollama",
  },
  {
    name: "llama3.2",
    description: "Meta's small Llama 3.2 models. 1b and 3b are laptop-friendly.",
    tags: ["1b", "3b"],
    source: "ollama",
  },
  {
    name: "qwen2.5",
    description: "Strong small Qwen models, including 0.5b and 1.5b.",
    tags: ["0.5b", "1.5b", "3b", "7b"],
    source: "ollama",
  },
  {
    name: "phi3",
    description: "Microsoft Phi-3 mini. Good quality for the size.",
    tags: ["mini", "3.8b"],
    source: "ollama",
  },
  {
    name: "gemma2",
    description: "Google Gemma 2. The 2b tag is a solid small default.",
    tags: ["2b", "9b"],
    source: "ollama",
  },
  {
    name: "moondream",
    description: "Very small vision model for images.",
    tags: ["latest"],
    source: "ollama",
  },
];

export const QUERY_SUGGESTIONS = [
  "qwen",
  "qwen2.5",
  "qwen2.5-coder",
  "qwen2.5vl",
  "qwen3",
  "qwen3-coder",
  "qwen3-vl",
  "llama",
  "llama3.2",
  "llama3.1",
  "llama3",
  "gemma",
  "gemma2",
  "gemma3",
  "phi",
  "phi3",
  "phi4",
  "mistral",
  "mistral-nemo",
  "mixtral",
  "deepseek",
  "deepseek-r1",
  "deepseek-v3",
  "smollm2",
  "smollm",
  "moondream",
  "llava",
  "minicpm-v",
  "codellama",
  "codegemma",
  "starcoder2",
  "granite",
  "command-r",
  "yi",
  "glm",
  "tinyllama",
  "vicuna",
  "dolphin",
  "openchat",
  "wizardlm",
  "olmo",
  "nemotron",
  "falcon",
];

const SKIP_PULL_TAGS = new Set([
  "tools",
  "cloud",
  "vision",
  "embedding",
  "thinking",
  "reasoning",
  "chat",
  "code",
]);

function named(name: string) {
  return new RegExp("&" + name + ";", "g");
}

export function decodeHtml(raw: string) {
  return raw
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(named("nbsp"), " ")
    .replace(named("quot"), '"')
    .replace(named("apos"), "'")
    .replace(named("lt"), "<")
    .replace(named("gt"), ">")
    .replace(named("amp"), "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key) continue;
    const id = key.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

export function suggestQueries(query: string, extra: string[] = []): string[] {
  const q = query.trim().toLowerCase();
  const pool = uniqueStrings([...QUERY_SUGGESTIONS, ...extra]);
  if (!q) return QUERY_SUGGESTIONS.slice(0, 12);
  return pool
    .map((item, index) => {
      const n = item.toLowerCase();
      if (n === q) return { item, score: -1 };
      if (n.startsWith(q)) return { item, score: index };
      if (n.includes(q)) return { item, score: 1000 + index };
      return { item, score: -1 };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => a.score - b.score || a.item.localeCompare(b.item))
    .map((row) => row.item)
    .slice(0, 8);
}

function isPullTag(tag: string) {
  const t = tag.toLowerCase();
  if (SKIP_PULL_TAGS.has(t)) return false;
  if (/^\d+(\.\d+)?k$/.test(t)) return false;
  if (/^\d+\.\d+m$/.test(t)) return false;
  if (/^\d+x\d+(\.\d+)?b$/.test(t)) return true;
  if (/^\d+(\.\d+)?[bm]$/.test(t)) return true;
  return /^(mini|small|medium|large|latest|instruct|coder)$/i.test(t);
}

export function libraryKey(model: LibraryModel) {
  return (model.pullId || `${model.source || "ollama"}:${model.name}`).toLowerCase();
}

export function stripQuantSuffix(id: string) {
  return id.replace(/:[^/:]+$/, "");
}

export function pullIdsFor(model: LibraryModel): string[] {
  if (model.pullId) {
    const base = stripQuantSuffix(model.pullId);
    if (!model.tags.length) return [model.pullId];
    return uniqueStrings([
      model.pullId,
      ...model.tags.map((tag) => (tag.includes("/") || tag.startsWith("hf.co") ? tag : `${base}:${tag}`)),
    ]);
  }
  const tags = model.tags.length ? model.tags.filter(isPullTag) : ["latest"];
  const ids = tags.map((tag) => (tag === "latest" ? model.name : `${model.name}:${tag}`));
  return uniqueStrings(ids);
}

export function sameOllamaId(a: string, b: string) {
  const n = (id: string) => (id.endsWith(":latest") ? id.slice(0, -7) : id);
  return a === b || n(a) === n(b);
}

export function filterLibrary(models: LibraryModel[], query: string): LibraryModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  const parts = q.split(/[\s,+/]+/).filter(Boolean);
  return models.filter((m) => {
    const blob = `${m.name} ${m.description} ${m.tags.join(" ")} ${m.repo ?? ""} ${m.pullId ?? ""}`.toLowerCase();
    if (parts.every((part) => blob.includes(part))) return true;
    return q.startsWith(m.name.toLowerCase());
  });
}

export function parseLibraryHtml(html: string): LibraryModel[] {
  const found = new Map<string, LibraryModel>();
  const re = /href="\/library\/([^"?#"]+)"/gi;
  const hits: { name: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = decodeURIComponent(match[1] ?? "").trim();
    if (!raw || raw.includes("/")) continue;
    hits.push({ name: raw.toLowerCase(), index: match.index });
  }
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const slice = html.slice(hit.index, hits[i + 1]?.index ?? hit.index + 2800);
    const prev = found.get(hit.name);
    const tags = new Set<string>(prev?.tags ?? []);
    const tagRe = />([A-Za-z0-9._-]+)<\/span>/g;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(slice))) {
      const tag = t[1]!.toLowerCase();
      if (isPullTag(tag)) tags.add(tag);
    }
    const descMatch = slice.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const description = decodeHtml(descMatch?.[1] ?? prev?.description ?? "");
    found.set(hit.name, {
      name: hit.name,
      description: description.slice(0, 220),
      tags: [...tags].slice(0, 12),
      source: "ollama",
    });
  }
  return [...found.values()];
}

export type HfModelHit = {
  id?: string;
  modelId?: string;
  downloads?: number;
  pipeline_tag?: string;
  tags?: string[];
  likes?: number;
};

export function formatDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function parseHfModels(hits: HfModelHit[]): LibraryModel[] {
  const out: LibraryModel[] = [];
  for (const hit of hits) {
    const id = (hit.id || hit.modelId || "").trim();
    if (!id || !id.includes("/")) continue;
    const short = id.split("/")[1] || id;
    const downloads = typeof hit.downloads === "number" ? formatDownloads(hit.downloads) : "";
    out.push({
      name: short.replace(/-GGUF$/i, ""),
      description: [id, downloads && `${downloads} downloads`, hit.pipeline_tag]
        .filter(Boolean)
        .join(" · "),
      tags: [],
      pulls: typeof hit.downloads === "number" ? String(hit.downloads) : undefined,
      source: "huggingface",
      repo: id,
      pullId: `hf.co/${id}`,
    });
  }
  return out;
}

export function quantFromFilename(file: string) {
  const base = (file.split("/").pop() || file).replace(/\.gguf$/i, "");
  const match = /\b(IQ\d+_[A-Z]+|Q\d+_[KSM](?:_[MS])?|Q\d+_\d+|Q\d+|BF16|F16|F32)\b/i.exec(base);
  return match?.[1] ? match[1].toUpperCase() : "";
}

export function quantsFromSiblings(files: { rfilename?: string }[]): string[] {
  const order = [
    "Q4_K_M",
    "Q4_K_S",
    "Q5_K_M",
    "Q5_K_S",
    "Q6_K",
    "Q8_0",
    "Q3_K_M",
    "IQ4_XS",
    "IQ4_NL",
    "Q2_K",
    "F16",
  ];
  const found = new Set<string>();
  for (const file of files) {
    const name = file.rfilename || "";
    if (!/\.gguf$/i.test(name)) continue;
    if (/-of-\d+/i.test(name)) continue;
    const quant = quantFromFilename(name);
    if (quant) found.add(quant);
  }
  return [...found].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 80 : ia) - (ib < 0 ? 80 : ib) || a.localeCompare(b);
  }).slice(0, 10);
}

export function parseModelUrl(input: string): LibraryModel | null {
  const raw = input.trim();
  if (!raw) return null;
  const hf =
    /(?:https?:\/\/)?(?:www\.)?(?:huggingface\.co|hf\.co)\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/(?:resolve|blob|tree)\/[^/\s]+\/(\S+\.gguf))?/i.exec(
      raw,
    );
  if (hf?.[1]) {
    const repo = hf[1];
    const quant = hf[2] ? quantFromFilename(hf[2]) : "";
    const pullId = quant ? `hf.co/${repo}:${quant}` : `hf.co/${repo}`;
    return {
      name: (repo.split("/")[1] || repo).replace(/-GGUF$/i, ""),
      description: `Install from Hugging Face (${repo})`,
      tags: quant ? [quant] : [],
      source: "huggingface",
      repo,
      pullId,
    };
  }
  const ollama = /(?:https?:\/\/)?(?:www\.)?ollama\.com\/library\/([A-Za-z0-9._:-]+)/i.exec(raw);
  if (ollama?.[1]) {
    const id = ollama[1];
    const [name, tag] = id.split(":");
    return {
      name: (name || id).toLowerCase(),
      description: `Install ${id} from the Ollama library`,
      tags: tag ? [tag] : [],
      source: "ollama",
    };
  }
  const scope = /(?:https?:\/\/)?(?:www\.)?modelscope\.cn\/(?:models\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i.exec(
    raw,
  );
  if (scope?.[1]) {
    const repo = scope[1];
    return {
      name: repo.split("/")[1] || repo,
      description: `Install from ModelScope via Hugging Face if the GGUF is mirrored (${repo})`,
      tags: [],
      source: "huggingface",
      repo,
      pullId: `hf.co/${repo}`,
    };
  }
  return null;
}

export function mergeLibrary(primary: LibraryModel[], extra: LibraryModel[]): LibraryModel[] {
  const map = new Map<string, LibraryModel>();
  for (const item of [...primary, ...extra]) {
    const key = libraryKey(item);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item, tags: uniqueStrings(item.tags) });
      continue;
    }
    map.set(key, {
      name: prev.name,
      description: prev.description || item.description,
      tags: uniqueStrings([...prev.tags, ...item.tags]),
      pulls: prev.pulls || item.pulls,
      source: prev.source || item.source,
      repo: prev.repo || item.repo,
      pullId: prev.pullId || item.pullId,
    });
  }
  return [...map.values()];
}

export function exactQueryModel(query: string): LibraryModel | null {
  const q = query.trim();
  if (!q) return null;
  const fromUrl = parseModelUrl(q);
  if (fromUrl) return fromUrl;
  const lower = q.toLowerCase();
  if (lower.startsWith("hf.co/") || lower.startsWith("huggingface.co/")) {
    return parseModelUrl(`https://${q}`);
  }
  if (!/^[a-z0-9._:-]+$/i.test(q)) return null;
  const [name, tag] = q.split(":");
  if (!name) return null;
  return {
    name: name.toLowerCase(),
    description: tag ? `Install ${q}` : `Install ${name} from the Ollama library`,
    tags: tag ? [tag] : [],
    source: "ollama",
  };
}
