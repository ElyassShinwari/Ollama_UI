import { createFileRoute } from "@tanstack/react-router";
import { installOllama, startOllama } from "@/lib/llm/setup.server";

export const Route = createFileRoute("/api/setup-install")({
  server: {
    handlers: {
      POST: async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (payload: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };
            try {
              await installOllama((line) => send({ line }));
              send({ line: "Starting Ollama…" });
              await startOllama((line) => send({ line }));
              send({ done: true, ok: true });
            } catch (err) {
              send({
                line: err instanceof Error ? err.message : "Install failed",
                done: true,
                ok: false,
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
