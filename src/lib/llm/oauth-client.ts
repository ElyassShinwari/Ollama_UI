import { useChatStore } from "@/lib/chat/store";
import type { OAuthSession } from "@/lib/chat/types";

function writeSession(provider: "openai" | "xai" | "kimi", session: OAuthSession | null) {
  const setSettings = useChatStore.getState().setSettings;
  if (provider === "openai") setSettings({ openaiOAuth: session });
  else if (provider === "xai") setSettings({ xaiOAuth: session });
  else setSettings({ kimiOAuth: session });
}

async function refreshIfNeeded(
  provider: "openai" | "xai" | "kimi",
  session: OAuthSession | null,
) {
  if (!session?.refreshToken) return session;
  if (session.expiresAt > Date.now() + 120_000) return session;
  try {
    const res = await fetch("/api/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", provider, refreshToken: session.refreshToken }),
    });
    const json = (await res.json().catch(() => ({}))) as { session?: OAuthSession; error?: string };
    if (res.ok && json.session) {
      writeSession(provider, json.session);
      return json.session;
    }
    const fatal = res.status === 401 || /invalid|expired|revoked|unauthorized/i.test(json.error || "");
    if (fatal) {
      writeSession(provider, null);
      return null;
    }
    return session;
  } catch {
    return session;
  }
}

export async function ensureCloudAuth() {
  const settings = useChatStore.getState().settings;
  await refreshIfNeeded("openai", settings.openaiOAuth);
  await refreshIfNeeded("xai", settings.xaiOAuth);
  await refreshIfNeeded("kimi", settings.kimiOAuth);
}
