import { createFileRoute } from "@tanstack/react-router";
import { oauthSupported, pollOAuth, refreshOAuth, startOAuth } from "@/lib/llm/oauth.server";
import type { CloudId } from "@/lib/llm/cloud";

type Body = {
  action?: "start" | "poll" | "refresh";
  provider?: CloudId;
  userCode?: string;
  deviceAuthId?: string;
  deviceCode?: string;
  refreshToken?: string;
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
        if (provider !== "openai" && provider !== "xai" && provider !== "anthropic" && provider !== "kimi" && provider !== "deepseek") {
          return Response.json({ error: "Unknown provider" }, { status: 400 });
        }
        try {
          if (body.action === "start") {
            if (!oauthSupported(provider)) {
              return Response.json(
                {
                  error:
                    provider === "anthropic"
                      ? "Anthropic does not allow other apps to sign in with Claude.ai. Use an API key from the Anthropic console."
                      : `${provider} does not offer in-app sign-in. Sign in on their site, then paste an API key.`,
                },
                { status: 400 },
              );
            }
            const start = await startOAuth(provider);
            return Response.json(start);
          }
          if (body.action === "poll") {
            if (provider !== "openai" && provider !== "xai") {
              return Response.json({ error: "Unsupported" }, { status: 400 });
            }
            const result = await pollOAuth({
              provider,
              userCode: body.userCode,
              deviceAuthId: body.deviceAuthId,
              deviceCode: body.deviceCode,
            });
            return Response.json(result);
          }
          if (body.action === "refresh") {
            if (provider !== "openai" && provider !== "xai") {
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
