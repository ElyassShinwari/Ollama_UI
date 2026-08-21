import { createFileRoute } from "@tanstack/react-router";
import { listOllamaModels } from "@/lib/llm/providers.server";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const host = url.searchParams.get("host") || "http://127.0.0.1:11434";

        const ollama = await listOllamaModels(host)
          .then((models) => ({ ok: true as const, models }))
          .catch((err: unknown) => ({
            ok: false as const,
            models: [] as Awaited<ReturnType<typeof listOllamaModels>>,
            error: err instanceof Error ? err.message : "Ollama unreachable",
          }));

        return Response.json({
          models: ollama.models,
          ollama: ollama.ok,
          xai: false,
          error: ollama.ok ? undefined : ollama.error,
        });
      },
    },
  },
});
