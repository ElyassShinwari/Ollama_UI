import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { sanitizeOllamaHost } from "@/lib/utils";

async function reply(text: string) {
  const studio = await loadStudio();
  const model = studio.defaultModel;
  if (!model) throw new Error("Set a default model in Studio");
  const host = sanitizeOllamaHost(studio.ollamaHost || process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
  const extras = studio.instructions.filter((i) => i.enabled).map((i) => i.text);
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        ...(extras.length ? [{ role: "system", content: extras.join("\n") }] : []),
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error("Ollama failed");
  const json = (await res.json()) as { message?: { content?: string } };
  return json.message?.content ?? "";
}

export const Route = createFileRoute("/api/channel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const studio = await loadStudio();
        if (mode === "subscribe") {
          if (studio.channelVerify && token === studio.channelVerify) {
            return new Response(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
          }
          return new Response("", { status: 403 });
        }
        return Response.json({ ok: true, service: "ollama-ui-channel" });
      },
      POST: async ({ request }) => {
        const studio = await loadStudio();
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? request.headers.get("x-channel-secret") ?? "";
        if (!studio.channelSecret || secret !== studio.channelSecret) {
          return Response.json({ error: "Bad secret" }, { status: 401 });
        }
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const wa =
          (((body.entry as { changes?: { value?: { messages?: { text?: { body?: string } }[] } }[] }[]) ?? [])[0]
            ?.changes ?? [])[0]?.value?.messages?.[0]?.text?.body;
        const ig =
          (((body.entry as { changes?: { value?: { messages?: { text?: string }[] } }[] }[]) ?? [])[0]?.changes ?? [])[0]
            ?.value?.messages?.[0]?.text;
        const text =
          (typeof body.message === "string" && body.message) ||
          (typeof body.text === "string" && body.text) ||
          wa ||
          (typeof ig === "string" ? ig : "") ||
          "";
        if (!text.trim()) return Response.json({ ok: true, ignored: true });
        try {
          const content = await reply(text.trim());
          return Response.json({ ok: true, reply: content });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Channel failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
