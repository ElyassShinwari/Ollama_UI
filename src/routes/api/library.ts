import { createFileRoute } from "@tanstack/react-router";
import {
  STARTER_MODELS,
  exactQueryModel,
  filterLibrary,
  mergeLibrary,
  parseLibraryHtml,
} from "@/lib/llm/library";

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
        let remote: ReturnType<typeof parseLibraryHtml> = [];
        try {
          const url = q
            ? `https://ollama.com/search?q=${encodeURIComponent(q)}`
            : "https://ollama.com/library";
          const res = await fetch(url, {
            headers: { "User-Agent": "Ollama-UI" },
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) remote = parseLibraryHtml(await res.text());
        } catch {
          remote = [];
        }
        const exact = exactQueryModel(q);
        const merged = mergeLibrary(STARTER_MODELS, remote);
        const models = q ? filterLibrary(merged, q) : merged;
        const withExact =
          exact && !models.some((m) => m.name === exact.name) ? [exact, ...models] : models;
        return Response.json({ models: withExact.slice(0, 24) });
      },
    },
  },
});
