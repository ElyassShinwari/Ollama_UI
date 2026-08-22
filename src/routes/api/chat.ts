import { createFileRoute } from "@tanstack/react-router";
import { cloudEndpoint, isChatGptOAuth } from "@/lib/llm/cloud";
import { streamAnthropicChat, streamCodexChat, streamOllamaChat, streamOpenAiCompat, streamXaiChat } from "@/lib/llm/providers.server";
import type { Provider } from "@/lib/chat/types";

type ChatBody = {
  provider?: Provider;
  host?: string;
  model?: string;
  messages?: { role: string; content: string; images?: string[] }[];
  temperature?: number;
  contextLength?: number;
  apiKey?: string;
  accountId?: string;
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

        const provider: Provider =
          body.provider === "openai" ||
          body.provider === "anthropic" ||
          body.provider === "xai" ||
          body.provider === "kimi" ||
          body.provider === "deepseek"
            ? body.provider
            : "ollama";
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
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
        const accountId = typeof body.accountId === "string" ? body.accountId : "";

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
              const turns = messages.map((m) => ({ role: m.role, content: m.content }));
              let iterator: AsyncGenerator<{ content?: string; usage?: { promptTokens: number; completionTokens: number } }>;
              if (provider === "ollama") {
                iterator = streamOllamaChat({
                  host,
                  model,
                  messages,
                  temperature,
                  contextLength,
                  signal: request.signal,
                });
              } else if (provider === "anthropic") {
                const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
                if (!key) throw new Error("Add a Claude API key in Settings or Studio → Cloud base");
                iterator = streamAnthropicChat({
                  apiKey: key,
                  model,
                  messages: turns,
                  temperature,
                  signal: request.signal,
                });
              } else if (provider === "xai" && !apiKey && process.env.XAI_API_KEY) {
                iterator = streamXaiChat({
                  model,
                  messages: turns,
                  temperature,
                  signal: request.signal,
                });
              } else {
                const key =
                  apiKey ||
                  (provider === "openai"
                    ? process.env.OPENAI_API_KEY
                    : provider === "kimi"
                      ? process.env.MOONSHOT_API_KEY
                      : provider === "deepseek"
                        ? process.env.DEEPSEEK_API_KEY
                        : process.env.XAI_API_KEY) ||
                  "";
                if (!key) throw new Error("Add an API key or sign in under Studio → Cloud base");
                if (provider === "openai" && isChatGptOAuth(key)) {
                  iterator = streamCodexChat({
                    apiKey: key,
                    accountId,
                    model,
                    messages: turns,
                    signal: request.signal,
                  });
                } else {
                  const url = cloudEndpoint(provider, key).url;
                  const extraHeaders: Record<string, string> = {};
                  if (provider === "openai" && accountId) extraHeaders["ChatGPT-Account-ID"] = accountId;
                  if (provider === "kimi" && !key.startsWith("sk-")) extraHeaders["User-Agent"] = "KimiCLI/1.5";
                  iterator = streamOpenAiCompat({
                    url,
                    apiKey: key,
                    model,
                    messages: turns,
                    temperature: provider === "kimi" && !key.startsWith("sk-") ? 1 : temperature,
                    signal: request.signal,
                    extraHeaders,
                  });
                }
              }
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
