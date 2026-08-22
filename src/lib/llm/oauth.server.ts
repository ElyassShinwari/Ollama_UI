import type { CloudId } from "@/lib/llm/cloud";
import type { OAuthSession } from "@/lib/chat/types";

const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_ISSUER = "https://auth.openai.com";
const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_DEVICE = "https://auth.x.ai/oauth2/device/code";
const XAI_TOKEN = "https://auth.x.ai/oauth2/token";
const XAI_SCOPE =
  "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write";

export type OAuthStart = {
  provider: "openai" | "xai";
  userCode: string;
  verificationUrl: string;
  interval: number;
  deviceAuthId?: string;
  deviceCode?: string;
};

function form(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}

function jwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((part.length * 3) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sessionFromTokens(access: string, refresh: string, expiresIn?: number): OAuthSession {
  const claims = jwtPayload(access);
  const exp = typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + (expiresIn || 3600) * 1000;
  const email =
    (typeof claims.email === "string" && claims.email) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    undefined;
  const accountId =
    (typeof claims.chatgpt_account_id === "string" && claims.chatgpt_account_id) ||
    (typeof claims["https://chatgpt.com/account_id"] === "string" &&
      (claims["https://chatgpt.com/account_id"] as string)) ||
    undefined;
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresAt: exp,
    email,
    accountId,
  };
}

export async function startOAuth(provider: CloudId): Promise<OAuthStart> {
  if (provider === "openai") {
    const res = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Originator: "codex_cli_rs" },
      body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || "ChatGPT sign-in is not available right now");
    }
    const json = JSON.parse(text) as {
      device_auth_id?: string;
      user_code?: string;
      usercode?: string;
      interval?: string | number;
    };
    const userCode = json.user_code || json.usercode || "";
    if (!json.device_auth_id || !userCode) throw new Error("ChatGPT did not return a sign-in code");
    return {
      provider: "openai",
      userCode,
      verificationUrl: `${OPENAI_ISSUER}/codex/device`,
      interval: Number(json.interval) || 5,
      deviceAuthId: json.device_auth_id,
    };
  }
  if (provider === "xai") {
    const res = await fetch(XAI_DEVICE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: XAI_CLIENT_ID, scope: XAI_SCOPE }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || "Grok sign-in is not available right now");
    const json = JSON.parse(text) as {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      verification_uri_complete?: string;
      interval?: number;
    };
    if (!json.device_code || !json.user_code) throw new Error("Grok did not return a sign-in code");
    return {
      provider: "xai",
      userCode: json.user_code,
      verificationUrl: json.verification_uri_complete || json.verification_uri || "https://auth.x.ai/device",
      interval: json.interval || 5,
      deviceCode: json.device_code,
    };
  }
  throw new Error("This company does not offer in-app sign-in. Use an API key.");
}

export async function pollOAuth(body: {
  provider: "openai" | "xai";
  userCode?: string;
  deviceAuthId?: string;
  deviceCode?: string;
}): Promise<{ pending: true } | { session: OAuthSession }> {
  if (body.provider === "openai") {
    if (!body.deviceAuthId || !body.userCode) throw new Error("Missing ChatGPT sign-in state");
    const res = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Originator: "codex_cli_rs" },
      body: JSON.stringify({ device_auth_id: body.deviceAuthId, user_code: body.userCode }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 403 || res.status === 404 || res.status === 400) return { pending: true };
    const text = await res.text();
    if (!res.ok) {
      if (/pending|authorization_pending|slow_down/i.test(text)) return { pending: true };
      throw new Error(text || "ChatGPT sign-in failed");
    }
    const json = JSON.parse(text) as {
      authorization_code?: string;
      code_verifier?: string;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (json.access_token && json.refresh_token) {
      return { session: sessionFromTokens(json.access_token, json.refresh_token, json.expires_in) };
    }
    if (!json.authorization_code || !json.code_verifier) return { pending: true };
    const tokenRes = await fetch(`${OPENAI_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        grant_type: "authorization_code",
        code: json.authorization_code,
        redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`,
        client_id: OPENAI_CLIENT_ID,
        code_verifier: json.code_verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) throw new Error(tokenText || "ChatGPT token exchange failed");
    const tokens = JSON.parse(tokenText) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokens.access_token || !tokens.refresh_token) throw new Error("ChatGPT did not return tokens");
    return { session: sessionFromTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in) };
  }

  if (!body.deviceCode) throw new Error("Missing Grok sign-in state");
  const res = await fetch(XAI_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: XAI_CLIENT_ID,
      device_code: body.deviceCode,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: { error?: string; access_token?: string; refresh_token?: string; expires_in?: number } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    json = {};
  }
  if (json.error === "authorization_pending" || json.error === "slow_down" || res.status === 400) {
    if (json.error === "authorization_pending" || json.error === "slow_down" || !json.error) {
      return { pending: true };
    }
  }
  if (!res.ok) throw new Error(json.error || text || "Grok sign-in failed");
  if (!json.access_token) return { pending: true };
  return {
    session: sessionFromTokens(json.access_token, json.refresh_token || json.access_token, json.expires_in),
  };
}

export async function refreshOAuth(
  provider: "openai" | "xai",
  refreshToken: string,
): Promise<OAuthSession> {
  if (provider === "openai") {
    const res = await fetch(`${OPENAI_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: OPENAI_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || "ChatGPT session expired. Sign in again.");
    const json = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("ChatGPT did not refresh the session");
    return sessionFromTokens(json.access_token, json.refresh_token || refreshToken, json.expires_in);
  }
  const res = await fetch(XAI_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: XAI_CLIENT_ID,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Grok session expired. Sign in again.");
  const json = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Grok did not refresh the session");
  return sessionFromTokens(json.access_token, json.refresh_token || refreshToken, json.expires_in);
}

export function oauthSupported(provider: CloudId) {
  return provider === "openai" || provider === "xai";
}
