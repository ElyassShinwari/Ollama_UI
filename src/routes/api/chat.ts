import { createFileRoute } from "@tanstack/react-router";
import { streamOllamaChat, streamXaiChat } from "@/lib/llm/providers.server";

type ChatBody = {
  provider?: "ollama" | "xai";
  host?: string;
  model?: string;
  messages?: { role: string; content: string }[];
  temperature?: number;
  contextLength?: number;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const provider = body.provider === "xai" ? "xai" : "ollama";
        const model = typeof body.model === "string" ? body.model : "";
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const temperature =
          typeof body.temperature === "number" && Number.isFinite(body.temperature)
            ? Math.min(2, Math.max(0, body.temperature))
            : 0.7;
        const host = typeof body.host === "string" ? body.host : "http://127.0.0.1:11434";
        const contextLength =
          typeof body.contextLength === "number" && Number.isFinite(body.contextLength)
            ? body.contextLength
            : undefined;

        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
        if (messages.length === 0) {
          return Response.json({ error: "Messages are required" }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (payload: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            };
            try {
              const iterator =
                provider === "xai"
                  ? streamXaiChat({
                      model,
                      messages,
                      temperature,
                      signal: request.signal,
                    })
                  : streamOllamaChat({
                      host,
                      model,
                      messages,
                      temperature,
                      contextLength,
                      signal: request.signal,
                    });
              for await (const event of iterator) {
                if (event.content) send({ content: event.content });
                if (event.usage) send({ usage: event.usage });
              }
              send({ done: true });
            } catch (err) {
              if ((err as { name?: string }).name === "AbortError") {
                send({ done: true });
              } else {
                send({
                  error: err instanceof Error ? err.message : "The model failed to reply",
                });
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
