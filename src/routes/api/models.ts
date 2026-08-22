import { createFileRoute } from "@tanstack/react-router";
import { listCloudModels, listOllamaModels } from "@/lib/llm/providers.server";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const host = url.searchParams.get("host") || "http://127.0.0.1:11434";
        const openaiKey = request.headers.get("x-openai-key") || "";
        const anthropicKey = request.headers.get("x-anthropic-key") || "";
        const xaiKey = request.headers.get("x-xai-key") || process.env.XAI_API_KEY || "";
        const kimiKey = request.headers.get("x-kimi-key") || "";

        const ollama = await listOllamaModels(host)
          .then((models) => ({ ok: true as const, models }))
          .catch((err: unknown) => ({
            ok: false as const,
            models: [] as Awaited<ReturnType<typeof listOllamaModels>>,
            error: err instanceof Error ? err.message : "Ollama unreachable",
          }));

        const [openai, anthropic, xai, kimi] = await Promise.all([
          listCloudModels("openai", openaiKey),
          listCloudModels("anthropic", anthropicKey),
          listCloudModels("xai", xaiKey),
          listCloudModels("kimi", kimiKey),
        ]);

        return Response.json({
          models: [...ollama.models, ...openai, ...anthropic, ...xai, ...kimi],
          ollama: ollama.ok,
          openai: openai.length > 0,
          anthropic: anthropic.length > 0,
          xai: xai.length > 0,
          kimi: kimi.length > 0,
          error: ollama.ok ? undefined : ollama.error,
        });
      },
    },
  },
});
