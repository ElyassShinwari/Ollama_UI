import { createFileRoute } from "@tanstack/react-router";
import {
  STARTER_MODELS,
  exactQueryModel,
  filterLibrary,
  mergeLibrary,
  parseHfModels,
  parseLibraryHtml,
  quantsFromSiblings,
  suggestQueries,
  libraryKey,
  type HfModelHit,
  type LibraryModel,
} from "@/lib/llm/library";

const UA = "Ollama-UI/1.0 (library)";

async function fetchText(url: string, timeout = 8000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) return "";
  return res.text();
}

async function fetchJson<T>(url: string, timeout = 8000): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function searchOllama(query: string): Promise<LibraryModel[]> {
  const url = query
    ? `https://ollama.com/search?q=${encodeURIComponent(query)}`
    : "https://ollama.com/library";
  try {
    const html = await fetchText(url);
    return html ? parseLibraryHtml(html) : [];
  } catch {
    return [];
  }
}

async function searchHuggingFace(query: string): Promise<LibraryModel[]> {
  const params = new URLSearchParams({
    filter: "gguf",
    sort: "downloads",
    direction: "-1",
    limit: query ? "24" : "8",
  });
  if (query) params.set("search", query);
  try {
    const hits = await fetchJson<HfModelHit[]>(
      `https://huggingface.co/api/models?${params.toString()}`,
    );
    return hits ? parseHfModels(hits) : [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const files = url.searchParams.get("files")?.trim() ?? "";
        if (files) {
          if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(files)) {
            return Response.json({ quants: [] });
          }
          try {
            const detail = await fetchJson<{ siblings?: { rfilename?: string }[] }>(
              `https://huggingface.co/api/models/${files}`,
              10000,
            );
            return Response.json({ quants: quantsFromSiblings(detail?.siblings ?? []) });
          } catch {
            return Response.json({ quants: [] });
          }
        }

        const q = url.searchParams.get("q")?.trim() ?? "";
        const [ollama, hf] = await Promise.all([searchOllama(q), searchHuggingFace(q)]);
        const exact = exactQueryModel(q);
        const starter = q ? filterLibrary(STARTER_MODELS, q) : STARTER_MODELS;
        const ollamaMerged = mergeLibrary(starter, ollama);
        const merged = q
          ? mergeLibrary(ollamaMerged, hf)
          : [...ollamaMerged.slice(0, 32), ...hf];
        const withExact =
          exact && !merged.some((m) => libraryKey(m) === libraryKey(exact)) ? [exact, ...merged] : merged;
        const models = withExact.slice(0, 48);
        const suggestions = suggestQueries(
          q,
          models.map((m) => m.name),
        );
        return Response.json({ models, suggestions });
      },
    },
  },
});
