import { createFileRoute } from "@tanstack/react-router";
import { loadStudio, saveStudio } from "@/lib/studio/config.server";
import { createStarterWorkflow, listWorkflows, probeN8n } from "@/lib/studio/n8n-server";
import { normalizeN8nBase } from "@/lib/studio/n8n";

export const Route = createFileRoute("/api/n8n/workflows")({
  server: {
    handlers: {
      GET: async () => {
        const studio = await loadStudio();
        if (!studio.n8nApiKey?.trim()) {
          return Response.json({
            workflows: [],
            hint: "Add an n8n API key to list workflows and to add starter workflows for you.",
          });
        }
        let base: string;
        try {
          base = normalizeN8nBase(studio.n8nBaseUrl || "", studio.n8nKind);
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Bad n8n address" },
            { status: 400 },
          );
        }
        const listed = await listWorkflows(base, studio.n8nApiKey);
        if (!listed.ok) {
          return Response.json({ error: listed.error || "Could not list workflows" }, { status: 502 });
        }
        return Response.json({ workflows: listed.workflows });
      },
      POST: async ({ request }) => {
        let body: { kind?: "ask" | "receive"; origin?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (body.kind !== "ask" && body.kind !== "receive") {
          return Response.json({ error: "kind must be ask or receive" }, { status: 400 });
        }
        const studio = await loadStudio();
        const origin = (body.origin || "").replace(/\/+$/, "");
        if (!origin) {
          return Response.json({ error: "Missing this app’s address" }, { status: 400 });
        }
        if (!studio.n8nEnabled) {
          return Response.json({ error: "Turn on “Allow n8n to talk to this app” first" }, { status: 403 });
        }
        const created = await createStarterWorkflow({
          kind: body.kind,
          baseUrl: studio.n8nBaseUrl,
          apiKey: studio.n8nApiKey,
          origin,
          secret: studio.n8nSecret,
          appApiKey: studio.apiKey,
          model: studio.defaultModel,
          n8nKind: studio.n8nKind,
        });
        if (!created.ok) {
          const probe = await probeN8n({
            baseUrl: studio.n8nBaseUrl,
            apiKey: studio.n8nApiKey,
            kind: studio.n8nKind,
          });
          return Response.json(
            { error: created.error, hint: probe.detail || probe.error },
            { status: 502 },
          );
        }
        if (body.kind === "receive" && created.webhookUrl) {
          await saveStudio({ n8nWebhookUrl: created.webhookUrl });
        }
        return Response.json(created);
      },
    },
  },
});
