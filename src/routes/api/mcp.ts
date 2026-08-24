import { createFileRoute } from "@tanstack/react-router";
import { loadStudio } from "@/lib/studio/config.server";
import { createMcpScaffold, listMcpTools } from "@/lib/studio/mcp.server";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          action?: string;
          id?: string;
          name?: string;
          description?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (body.action === "create") {
          try {
            const scaffold = await createMcpScaffold(body.name || "my-mcp", body.description || "");
            return Response.json({ ok: true, ...scaffold });
          } catch (err) {
            return Response.json(
              { error: err instanceof Error ? err.message : "Could not create MCP server" },
              { status: 500 },
            );
          }
        }
        const studio = await loadStudio();
        const server = studio.mcpServers.find((s) => s.id === body.id);
        if (!server) return Response.json({ error: "MCP server not found" }, { status: 404 });
        try {
          const tools = await listMcpTools(server);
          return Response.json({ ok: true, tools });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "MCP failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
