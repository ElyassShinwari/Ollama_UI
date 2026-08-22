import { createFileRoute } from "@tanstack/react-router";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/pull")({
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
        const host = sanitizeOllamaHost(body.host || "http://127.0.0.1:11434");

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (payload: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };
            try {
              const res = await fetch(`${host}/api/pull`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: model, model, stream: true }),
                signal: request.signal,
              });
              if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "");
                send({ error: text || `Pull failed (${res.status})`, done: true });
                controller.close();
                return;
              }
              const reader = res.body.getReader();
              const dec = new TextDecoder();
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split("\n");
                buf = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const json = JSON.parse(line) as {
                      status?: string;
                      digest?: string;
                      total?: number;
                      completed?: number;
                      error?: string;
                    };
                    if (json.error) {
                      send({ error: json.error, done: true });
                      controller.close();
                      return;
                    }
                    send({
                      status: json.status,
                      total: json.total,
                      completed: json.completed,
                    });
                  } catch {
                    /* skip */
                  }
                }
              }
              send({ done: true, ok: true, status: "success" });
            } catch (err) {
              send({
                error: err instanceof Error ? err.message : "Pull failed",
                done: true,
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
