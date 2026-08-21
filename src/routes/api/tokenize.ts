import { createFileRoute } from "@tanstack/react-router";
import { tokenizeOllama } from "@/lib/llm/tokens";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/tokenize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { host?: string; model?: string; prompt?: string };
        try {
          body = (await request.json()) as { host?: string; model?: string; prompt?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const model = typeof body.model === "string" ? body.model : "";
        const prompt = typeof body.prompt === "string" ? body.prompt : "";
        const host = typeof body.host === "string" ? body.host : "http://127.0.0.1:11434";
        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
        try {
          const count = await tokenizeOllama(sanitizeOllamaHost(host), model, prompt);
          if (count == null) {
            return Response.json({ error: "Tokenizer unavailable" }, { status: 502 });
          }
          return Response.json({ count });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Tokenizer failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
