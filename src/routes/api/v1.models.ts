import { createFileRoute } from "@tanstack/react-router";
import { listOllamaModels } from "@/lib/llm/providers.server";
import { studioKeyOk } from "@/lib/studio/api-auth.server";
import { loadStudio } from "@/lib/studio/config.server";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/v1/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const studio = await loadStudio();
        if (!studio.apiEnabled) {
          return Response.json({ error: "API is disabled in Studio" }, { status: 403 });
        }
        if (!studioKeyOk(request, studio)) {
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        const host = sanitizeOllamaHost(studio.ollamaHost || "http://127.0.0.1:11434");
        try {
          const models = await listOllamaModels(host);
          return Response.json({
            object: "list",
            data: models.map((m) => ({
              id: m.id,
              object: "model",
              owned_by: "ollama",
            })),
          });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Could not list models" },
            { status: 502 },
          );
        }
      },
    },
  },
});
