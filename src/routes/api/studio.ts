import { createFileRoute } from "@tanstack/react-router";
import { loadStudio, saveStudio } from "@/lib/studio/config.server";

export const Route = createFileRoute("/api/studio")({
  server: {
    handlers: {
      GET: async () => Response.json(await loadStudio()),
      POST: async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return Response.json(await saveStudio(patch));
      },
    },
  },
});
