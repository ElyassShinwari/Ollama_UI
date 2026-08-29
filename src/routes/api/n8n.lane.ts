import { createFileRoute } from "@tanstack/react-router";
import { chatIsBusy, n8nLaneBusy, setChatBusy } from "@/lib/studio/lane.server";

export const Route = createFileRoute("/api/n8n/lane")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          chat: chatIsBusy(),
          n8n: n8nLaneBusy(),
        }),
      POST: async ({ request }) => {
        let body: { chat?: boolean };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        setChatBusy(body.chat === true);
        return Response.json({ ok: true, chat: chatIsBusy(), n8n: n8nLaneBusy() });
      },
    },
  },
});
