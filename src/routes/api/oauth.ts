import { createFileRoute } from "@tanstack/react-router";
import { completeOAuth, oauthSupported, pollOAuth, refreshOAuth, startOAuth } from "@/lib/llm/oauth.server";
import type { CloudId } from "@/lib/llm/cloud";

type Body = {
  action?: "start" | "poll" | "refresh" | "complete";
  provider?: CloudId;
  userCode?: string;
  deviceAuthId?: string;
  deviceCode?: string;
  refreshToken?: string;
  handle?: string;
  callback?: string;
};

export const Route = createFileRoute("/api/oauth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const provider = body.provider;
        if (
          provider !== "openai" &&
          provider !== "anthropic" &&
          provider !== "xai" &&
          provider !== "kimi" &&
          provider !== "deepseek"
        ) {
          return Response.json({ error: "Unknown provider" }, { status: 400 });
        }
        try {
          if (body.action === "start") {
            const start = await startOAuth(provider);
            return Response.json(start);
          }
          if (body.action === "poll") {
            if (!oauthSupported(provider)) {
              return Response.json({ error: "Unsupported" }, { status: 400 });
            }
            const result = await pollOAuth({
              provider,
              handle: body.handle,
              userCode: body.userCode,
              deviceAuthId: body.deviceAuthId,
              deviceCode: body.deviceCode,
            });
            return Response.json(result);
          }
          if (body.action === "complete") {
            if (!body.handle || !body.callback) {
              return Response.json({ error: "Paste the address from the browser after ChatGPT login" }, { status: 400 });
            }
            const session = await completeOAuth(body.handle, body.callback);
            return Response.json({ session });
          }
          if (body.action === "refresh") {
            if (!oauthSupported(provider)) {
              return Response.json({ error: "Unsupported" }, { status: 400 });
            }
            if (!body.refreshToken) return Response.json({ error: "Missing refresh token" }, { status: 400 });
            const session = await refreshOAuth(provider, body.refreshToken);
            return Response.json({ session });
          }
          return Response.json({ error: "Unknown action" }, { status: 400 });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Sign-in failed" },
            { status: 400 },
          );
        }
      },
    },
  },
});
