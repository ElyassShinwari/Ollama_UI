import { createFileRoute } from "@tanstack/react-router";
import {
  compatModelsUrl,
  isCompatChatModel,
  parseCompatModelIds,
  sanitizeCompatBase,
} from "@/lib/llm/custom";

export const Route = createFileRoute("/api/custom-models")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { baseUrl?: string; apiKey?: string };
        try {
          body = (await request.json()) as { baseUrl?: string; apiKey?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        let base: string;
        try {
          base = sanitizeCompatBase(typeof body.baseUrl === "string" ? body.baseUrl : "");
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Invalid base URL" },
            { status: 400 },
          );
        }
        const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
        const headers: Record<string, string> = { Accept: "application/json" };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        try {
          const res = await fetch(compatModelsUrl(base), {
            headers,
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return Response.json(
              { error: text || `Could not list models (${res.status})`, models: [] },
              { status: 200 },
            );
          }
          const ids = parseCompatModelIds(await res.json())
            .filter(isCompatChatModel)
            .slice(0, 50);
          return Response.json({ models: ids, base });
        } catch (err) {
          return Response.json(
            {
              error: err instanceof Error ? err.message : "Could not reach that server",
              models: [] as string[],
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
