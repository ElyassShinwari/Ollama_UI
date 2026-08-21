import { createFileRoute } from "@tanstack/react-router";
import { unloadOllamaModel } from "@/lib/llm/providers.server";

export const Route = createFileRoute("/api/reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { host?: string; model?: string };
        try {
          body = (await request.json()) as { host?: string; model?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const model = typeof body.model === "string" ? body.model : "";
        const host = typeof body.host === "string" ? body.host : "http://127.0.0.1:11434";
        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
        try {
          await unloadOllamaModel(host, model);
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: true, unloaded: false });
        }
      },
    },
  },
});
