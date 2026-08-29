import { createFileRoute } from "@tanstack/react-router";
import { probeN8n, scanLocalN8n } from "@/lib/studio/n8n-server";
import { n8nOutboundBody, sanitizeWebhookUrl, type N8nKind } from "@/lib/studio/n8n";

export const Route = createFileRoute("/api/n8n/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          kind?: string;
          baseUrl?: string;
          apiKey?: string;
          webhookUrl?: string;
          n8nKind?: N8nKind;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (body.kind === "scan") {
          const probe = await scanLocalN8n(body.baseUrl);
          return Response.json(probe);
        }
        if (body.kind === "webhook") {
          let webhook: string;
          try {
            webhook = sanitizeWebhookUrl(body.webhookUrl ?? "");
          } catch (err) {
            return Response.json(
              { error: err instanceof Error ? err.message : "Bad webhook URL" },
              { status: 400 },
            );
          }
          try {
            const res = await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(n8nOutboundBody({ event: "ping" })),
              signal: AbortSignal.timeout(8000),
            });
            const text = await res.text().catch(() => "");
            if (!res.ok) {
              return Response.json(
                {
                  ok: false,
                  error:
                    text.trim().slice(0, 400) ||
                    `n8n webhook returned ${res.status}. If this is a test URL, press Listen for test event in n8n first.`,
                },
                { status: 502 },
              );
            }
            return Response.json({ ok: true, status: res.status, detail: "n8n received the test ping." });
          } catch (err) {
            return Response.json(
              {
                ok: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Could not reach that webhook. Open n8n, copy the Webhook node URL, and paste it here.",
              },
              { status: 502 },
            );
          }
        }

        const probe = await probeN8n({
          baseUrl: body.baseUrl || "",
          apiKey: body.apiKey,
          kind: body.n8nKind,
        });
        if (!probe.ok) {
          return Response.json({ ok: false, error: probe.error || probe.detail, base: probe.base });
        }
        return Response.json(probe);
      },
    },
  },
});
