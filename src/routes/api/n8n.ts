import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { extractN8nMessage, extractN8nModel } from "@/lib/studio/n8n";
import { sanitizeOllamaHost } from "@/lib/utils";

function secretOk(request: Request, secret: string) {
  if (!secret) return false;
  const url = new URL(request.url);
  const given =
    url.searchParams.get("secret") ??
    request.headers.get("x-n8n-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return given === secret;
}

async function runModel(text: string, modelId: string, hostRaw: string, extras: string[]) {
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
          enabled: studio.n8nEnabled !== false,
          defaultModel: studio.defaultModel || "",
          hint: "POST { message } with header x-n8n-secret. In Studio → n8n you can add a starter workflow instead of wiring this by hand.",
          origin: url.origin,
        });
      },
      POST: async ({ request }) => {
        const studio = await loadStudio();
        if (studio.n8nEnabled === false) {
          return Response.json({ error: "n8n is turned off in Studio" }, { status: 403 });
        }
        if (!secretOk(request, studio.n8nSecret)) {
          return Response.json({ error: "Bad n8n secret" }, { status: 401 });
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
        const extras = studio.instructions.filter((i) => i.enabled).map((i) => i.text);
        try {
          const reply = await runModel(text, model, studio.ollamaHost, extras);
          return Response.json({ ok: true, reply, model });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "n8n inbound failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
