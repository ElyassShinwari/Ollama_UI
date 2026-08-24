import { createFileRoute } from "@tanstack/react-router";
import { loadStudio, saveStudio } from "@/lib/studio/config.server";

export const Route = createFileRoute("/api/studio")({
  server: {
    handlers: {
      GET: async () => Response.json(await loadStudio()),
      POST: async ({ request }) => {
        let patch: Record<string, unknown>;
        try {
          patch = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
          return Response.json({ error: "Invalid body" }, { status: 400 });
        }
        return Response.json(await saveStudio(patch));
      },
    },
  },
});
