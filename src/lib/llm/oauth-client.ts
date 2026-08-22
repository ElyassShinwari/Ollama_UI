import { useChatStore } from "@/lib/chat/store";
import type { OAuthSession } from "@/lib/chat/types";

async function refreshIfNeeded(provider: "openai" | "xai", session: OAuthSession | null) {
  if (!session?.refreshToken) return session;
  if (session.expiresAt > Date.now() + 120_000) return session;
  const res = await fetch("/api/oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh", provider, refreshToken: session.refreshToken }),
  });
  const json = (await res.json()) as { session?: OAuthSession; error?: string };
  if (!res.ok || !json.session) return session;
  if (provider === "openai") useChatStore.getState().setSettings({ openaiOAuth: json.session });
  else useChatStore.getState().setSettings({ xaiOAuth: json.session });
  return json.session;
}

export async function ensureCloudAuth() {
  const settings = useChatStore.getState().settings;
  await refreshIfNeeded("openai", settings.openaiOAuth);
  await refreshIfNeeded("xai", settings.xaiOAuth);
}
