import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github-pr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          token?: string;
          owner?: string;
          repo?: string;
          title?: string;
          head?: string;
          base?: string;
          prBody?: string;
        };
        const token = body.token?.trim();
        const owner = body.owner?.trim();
        const repo = body.repo?.trim();
        const title = body.title?.trim();
        const head = body.head?.trim();
        const base = body.base?.trim() || "main";
        if (!token || !owner || !repo || !title || !head) {
          return Response.json({ error: "Token, owner, repo, title, and head branch are required" }, { status: 400 });
        }
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Ollama-UI",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            head,
            base,
            body: body.prBody || "",
          }),
        });
        const json = (await res.json()) as { html_url?: string; message?: string; errors?: { message?: string }[] };
        if (!res.ok) {
          return Response.json(
            { error: json.message || json.errors?.[0]?.message || "Could not create the pull request" },
            { status: res.status },
          );
        }
        return Response.json({ ok: true, url: json.html_url });
      },
    },
  },
});
