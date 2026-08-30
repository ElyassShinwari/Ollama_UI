import { createFileRoute } from "@tanstack/react-router";
import { sanitizeOllamaHost } from "@/lib/utils";
import {
  cancelServerPull,
  listServerPulls,
  startServerPull,
  subscribeServerPull,
} from "@/lib/llm/pull-jobs.server";

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export const Route = createFileRoute("/api/pull")({
  server: {
    handlers: {
      GET: async () => Response.json({ jobs: listServerPulls() }),
      POST: async ({ request }) => {
        let body: { host?: string; model?: string; cancel?: boolean };
        try {
          body = (await request.json()) as { host?: string; model?: string; cancel?: boolean };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const model = typeof body.model === "string" ? body.model.trim() : "";
        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });

        if (body.cancel) {
          cancelServerPull(model);
          return Response.json({ ok: true });
        }

        let host: string;
        try {
          host = sanitizeOllamaHost(body.host || "http://127.0.0.1:11434");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Invalid host" },
            { status: 400 },
          );
        }

        startServerPull(host, model);

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            let unsub = () => {};
            const send = (payload: unknown) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };
            const onAbort = () => close();
            function close() {
              if (closed) return;
              closed = true;
              request.signal.removeEventListener("abort", onAbort);
              unsub();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
            unsub = subscribeServerPull(model, (event) => {
              send(event);
              if (event.done) close();
            });
            if (!closed) request.signal.addEventListener("abort", onAbort);
            if (request.signal.aborted) onAbort();
          },
        });

        return sseResponse(stream);
      },
    },
  },
});
