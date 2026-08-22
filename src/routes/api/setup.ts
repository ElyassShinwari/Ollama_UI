import { createFileRoute } from "@tanstack/react-router";
import { setupStatus } from "@/lib/llm/setup.server";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const host = url.searchParams.get("host") || "http://127.0.0.1:11434";
        const status = await setupStatus(host);
        return Response.json(status);
      },
    },
  },
});
