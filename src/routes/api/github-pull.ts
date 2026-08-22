import { createFileRoute } from "@tanstack/react-router";
import { loadStudio, saveStudio } from "@/lib/studio/config.server";
import { pullRepo } from "@/lib/studio/git.server";

export const Route = createFileRoute("/api/github-pull")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { id?: string };
        const studio = await loadStudio();
        const repo = studio.repos.find((r) => r.id === body.id);
        if (!repo) return Response.json({ error: "Repo not found" }, { status: 404 });
        try {
          const result = await pullRepo(repo.path);
          const repos = studio.repos.map((r) =>
            r.id === repo.id ? { ...r, pulledAt: Date.now() } : r,
          );
          await saveStudio({ repos });
          return Response.json({ ok: true, log: result.out, repos });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Pull failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
