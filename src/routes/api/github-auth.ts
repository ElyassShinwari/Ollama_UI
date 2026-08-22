import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { token?: string };
        const token = body.token?.trim();
        if (!token) return Response.json({ error: "Token is required" }, { status: 400 });
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Ollama-UI",
          },
        });
        if (!res.ok) {
          return Response.json({ error: "GitHub did not accept that token" }, { status: 401 });
        }
        const user = (await res.json()) as { login?: string; name?: string; html_url?: string };
        return Response.json({ login: user.login, name: user.name, url: user.html_url });
      },
    },
  },
});
