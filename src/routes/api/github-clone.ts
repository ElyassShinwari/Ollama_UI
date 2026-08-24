import { createFileRoute } from "@tanstack/react-router";
import { loadStudio, saveStudio } from "@/lib/studio/config.server";
import { cloneRepo } from "@/lib/studio/git.server";

export const Route = createFileRoute("/api/github-clone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { url?: string; token?: string };
        try {
          body = (await request.json()) as { url?: string; token?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!body.url) return Response.json({ error: "Repository is required" }, { status: 400 });
        try {
          const studio = await loadStudio();
          const result = await cloneRepo(body.url, body.token || studio.githubToken);
          const repos = [
            {
              id: result.slug,
              name: `${result.owner}/${result.repo}`,
              url: `https://github.com/${result.owner}/${result.repo}`,
              path: result.path,
              pulledAt: Date.now(),
            },
            ...studio.repos.filter((r) => r.id !== result.slug),
          ];
          await saveStudio({ repos });
          return Response.json({ ok: true, ...result, repos });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Clone failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
