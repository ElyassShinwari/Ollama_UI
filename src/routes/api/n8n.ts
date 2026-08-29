import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { extractN8nMessage, extractN8nModel } from "@/lib/studio/n8n";
import { chatIsBusy, enterN8n, leaveN8n } from "@/lib/studio/lane.server";
import { sanitizeOllamaHost } from "@/lib/utils";

function givenKey(request: Request) {
  const url = new URL(request.url);
  return (
    url.searchParams.get("key") ??
    url.searchParams.get("secret") ??
    request.headers.get("x-api-key") ??
    request.headers.get("x-n8n-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

function keyOk(given: string, ...keys: string[]) {
  if (!given) return false;
  return keys.some((key) => Boolean(key) && given === key);
}

function busyResponse(retryMs: number, reason: "chat" | "n8n") {
  const seconds = Math.max(1, Math.ceil(retryMs / 1000));
  return Response.json(
    {
      error:
        reason === "chat"
          ? "A chat is using the model. n8n should retry in a moment."
          : "Another n8n job is using the model. Retry shortly.",
      retry: true,
      retryAfter: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  );
}

async function runModel(
  text: string,
  modelId: string,
  hostRaw: string,
  extras: string[],
  signal: AbortSignal,
) {
  const host = sanitizeOllamaHost(hostRaw || "http://127.0.0.1:11434");
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      stream: false,
      messages: [
        ...(extras.length ? [{ role: "system", content: extras.join("\n\n") }] : []),
        { role: "user", content: text },
      ],
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err.trim() || "Ollama failed");
  }
  const json = (await res.json()) as { message?: { content?: string } };
  return json.message?.content ?? "";
}

export const Route = createFileRoute("/api/n8n")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const studio = await loadStudio();
        const url = new URL(request.url);
        return Response.json({
          ok: true,
          service: "ollama-ui-n8n",
          inbound: "/api/n8n",
          completions: `${url.origin}/api/v1/chat/completions`,
          models: `${url.origin}/api/v1/models`,
          enabled: studio.n8nEnabled !== false,
          defaultModel: studio.defaultModel || "",
          chatBusy: chatIsBusy(),
          connection: {
            selfHosted: {
              provider: "Self-hosted",
              baseUrl: `${url.origin}/api/v1`,
              api: "paste the Fast API key from Studio → n8n",
              model: studio.defaultModel || "",
            },
            ollama: {
              provider: "Ollama",
              baseUrl: studio.ollamaHost || "http://127.0.0.1:11434",
              api: "(leave blank)",
              model: studio.defaultModel || "",
            },
          },
          hint: "POST { message } with Authorization: Bearer <API key>. For n8n’s Chat Model node, paste the Self-hosted or Ollama connection from Studio → n8n.",
          origin: url.origin,
        });
      },
      POST: async ({ request }) => {
        const studio = await loadStudio();
        if (studio.n8nEnabled === false) {
          return Response.json({ error: "n8n is turned off in Studio" }, { status: 403 });
        }
        if (!keyOk(givenKey(request), studio.apiKey, studio.n8nSecret)) {
          return Response.json(
            { error: "Bad API key. Use Authorization: Bearer <key> from Studio → n8n." },
            { status: 401 },
          );
        }
        if (chatIsBusy()) {
          return busyResponse(2_000, "chat");
        }
        const body = await request.json().catch(() => ({}));
        const text = extractN8nMessage(body);
        if (!text) {
          return Response.json(
            { error: "Send JSON with a message, text, chatInput, or prompt field" },
            { status: 400 },
          );
        }
        const model = extractN8nModel(body, studio.defaultModel);
        if (!model) {
          return Response.json({ error: "Set a default model in Studio → n8n" }, { status: 400 });
        }
        const slot = enterN8n();
        if (!slot.ok) {
          return busyResponse(slot.retryMs, chatIsBusy() ? "chat" : "n8n");
        }
        const extras = studio.instructions.filter((i) => i.enabled).map((i) => i.text);
        try {
          const reply = await runModel(text, model, studio.ollamaHost, extras, slot.signal);
          return Response.json({ ok: true, reply, model });
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") {
            return busyResponse(2_000, "chat");
          }
          return Response.json(
            { error: err instanceof Error ? err.message : "n8n inbound failed" },
            { status: 502 },
          );
        } finally {
          leaveN8n();
        }
      },
    },
  },
});
