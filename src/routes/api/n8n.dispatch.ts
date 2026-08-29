import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { n8nOutboundBody, sanitizeWebhookUrl, type N8nChatEvent } from "@/lib/studio/n8n";

export const Route = createFileRoute("/api/n8n/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const studio = await loadStudio();
        if (studio.n8nEnabled === false) {
          return Response.json({ skipped: true, reason: "n8n is off" });
        }
        if (!studio.n8nWebhookUrl?.trim()) {
          return Response.json({ error: "Paste an n8n webhook URL in Studio" }, { status: 400 });
        }
        let webhook: string;
        try {
          webhook = sanitizeWebhookUrl(studio.n8nWebhookUrl);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Bad webhook URL" },
            { status: 400 },
          );
        }
        let event: N8nChatEvent;
        try {
          event = (await request.json()) as N8nChatEvent;
        } catch {
          event = { event: "ping" };
        }
        try {
          const res = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(n8nOutboundBody(event)),
          });
          const text = await res.text().catch(() => "");
          if (!res.ok) {
            return Response.json(
              { ok: false, error: text.trim().slice(0, 400) || `n8n returned ${res.status}` },
              { status: 502 },
            );
          }
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Could not reach n8n" },
            { status: 502 },
          );
        }
      },
    },
  },
});
