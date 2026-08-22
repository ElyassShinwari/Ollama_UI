import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { sanitizeOllamaHost } from "@/lib/utils";

export const Route = createFileRoute("/api/v1/chat/completions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const studio = await loadStudio();
        if (!studio.apiEnabled) {
          return Response.json({ error: "API is disabled in Studio" }, { status: 403 });
        }
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!studio.apiKey || token !== studio.apiKey) {
          return Response.json({ error: "Invalid API key" }, { status: 401 });
        }
        const body = (await request.json()) as {
          model?: string;
          messages?: { role: string; content: string }[];
          temperature?: number;
          stream?: boolean;
        };
        const model = body.model || studio.defaultModel;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!model) return Response.json({ error: "Model is required" }, { status: 400 });
        if (messages.length === 0) return Response.json({ error: "Messages are required" }, { status: 400 });
        const host = sanitizeOllamaHost(process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
        const extras = studio.instructions.filter((i) => i.enabled).map((i) => i.text);
        const knowledge = studio.knowledgeEnabled
          ? studio.knowledge.slice(0, 8).map((k) => `# ${k.title}\n${k.text.slice(0, 4000)}`)
          : [];
        const systemBits = [...extras, ...knowledge].filter(Boolean);
        const payload = {
          model,
          messages: systemBits.length
            ? [{ role: "system", content: systemBits.join("\n\n") }, ...messages]
            : messages,
          stream: Boolean(body.stream),
          options: { temperature: body.temperature ?? 0.7 },
        };
        const res = await fetch(`${host}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return Response.json({ error: text || "Ollama failed" }, { status: 502 });
        }
        if (body.stream && res.body) {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const reader = res.body!.getReader();
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
                    const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
                    const chunk = json.message?.content ?? "";
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: "ollama-ui",
                          object: "chat.completion.chunk",
                          choices: [{ index: 0, delta: { content: chunk }, finish_reason: json.done ? "stop" : null }],
                        })}\n\n`,
                      ),
                    );
                  } catch {
                    /* skip */
                  }
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream; charset=utf-8" },
          });
        }
        const json = (await res.json()) as { message?: { content?: string } };
        return Response.json({
          id: "ollama-ui",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: json.message?.content ?? "" },
              finish_reason: "stop",
            },
          ],
          model,
        });
      },
    },
  },
});
