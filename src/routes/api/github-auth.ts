import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { token?: string };
        try {
          body = (await request.json()) as { token?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const token = body.token?.trim();
        if (!token) return Response.json({ error: "Token is required" }, { status: 400 });
        try {
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
          const user = (await res.json().catch(() => ({}))) as {
            login?: string;
            name?: string;
            html_url?: string;
          };
          return Response.json({ login: user.login, name: user.name, url: user.html_url });
        } catch {
          return Response.json({ error: "Could not reach GitHub" }, { status: 502 });
        }
      },
    },
  },
});
