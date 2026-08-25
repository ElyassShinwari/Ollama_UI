import { createFileRoute } from "@tanstack/react-router";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/delete-model")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { host?: string; model?: string };
        try {
          body = (await request.json()) as { host?: string; model?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const model = typeof body.model === "string" ? body.model.trim() : "";
        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
        let host: string;
        try {
          host = sanitizeOllamaHost(body.host || "http://127.0.0.1:11434");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Invalid host" },
            { status: 400 },
          );
        }

        try {
          const res = await fetch(`${host}/api/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model }),
            signal: AbortSignal.timeout(60000),
          });
          const text = await res.text().catch(() => "");
          if (!res.ok) {
            let message = text || `Ollama returned ${res.status}`;
            try {
              const json = JSON.parse(text) as { error?: string };
              if (json.error) message = json.error;
            } catch {
              /* plain text */
            }
            return Response.json({ error: message }, { status: res.status === 404 ? 404 : 400 });
          }
          return Response.json({ ok: true, model });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Could not delete the model" },
            { status: 502 },
          );
        }
      },
    },
  },
});
