import { createFileRoute } from "@tanstack/react-router";
import { setupStatus } from "@/lib/llm/setup.server";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let host: string;
        try {
          host = sanitizeOllamaHost(url.searchParams.get("host") || "http://127.0.0.1:11434");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Invalid host" },
            { status: 400 },
          );
        }
        const status = await setupStatus(host);
        return Response.json(status);
      },
    },
  },
});
