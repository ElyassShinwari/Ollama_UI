import crypto from "node:crypto";
import http from "node:http";
import type { CloudId } from "@/lib/llm/cloud";
import type { OAuthSession } from "@/lib/chat/types";

const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_ISSUER = "https://auth.openai.com";
const OPENAI_SCOPE = "openid profile email offline_access api.connectors.read api.connectors.invoke";
const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_DEVICE = "https://auth.x.ai/oauth2/device/code";
const XAI_TOKEN = "https://auth.x.ai/oauth2/token";
const XAI_SCOPE =
  "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write";
const KIMI_CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
const KIMI_DEVICE = "https://auth.kimi.com/api/oauth/device_authorization";
const KIMI_TOKEN = "https://auth.kimi.com/api/oauth/token";

export type OAuthProvider = "openai" | "xai" | "kimi";

export type OAuthStart = {
  provider: OAuthProvider;
  method: "browser" | "device";
  userCode?: string;
  verificationUrl: string;
  interval: number;
  handle?: string;
  deviceAuthId?: string;
  deviceCode?: string;
  pasteHint?: boolean;
};

type PendingBrowser = {
  provider: "openai";
  verifier: string;
  state: string;
  redirectUri: string;
  session?: OAuthSession;
  error?: string;
};

const pendingBrowser = new Map<string, PendingBrowser>();
let loopback: http.Server | null = null;
let loopbackPort = 0;

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
  const idClaims = jwtPayload(refresh);
  const exp = typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + (expiresIn || 3600) * 1000;
  const email =
    (typeof claims.email === "string" && claims.email) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof idClaims.email === "string" && idClaims.email) ||
    undefined;
  const accountId =
    (typeof claims.chatgpt_account_id === "string" && claims.chatgpt_account_id) ||
    (typeof claims["https://api.openai.com/auth"] === "object" &&
      claims["https://api.openai.com/auth"] !== null &&
      typeof (claims["https://api.openai.com/auth"] as { chatgpt_account_id?: unknown }).chatgpt_account_id ===
        "string" &&
      (claims["https://api.openai.com/auth"] as { chatgpt_account_id: string }).chatgpt_account_id) ||
    undefined;
  return { accessToken: access, refreshToken: refresh, expiresAt: exp, email, accountId };
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#111;color:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:28rem;padding:2rem;border:1px solid #333;border-radius:1rem}</style></head>
<body><main><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></main></body></html>`;
}

async function exchangeOpenai(code: string, redirectUri: string, verifier: string) {
  const tokenRes = await fetch(`${OPENAI_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: OPENAI_CLIENT_ID,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) throw new Error(tokenText || "ChatGPT token exchange failed");
  const tokens = JSON.parse(tokenText) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("ChatGPT did not return tokens");
  return sessionFromTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
}

function finishBrowser(state: string | null, code: string | null, error: string | null) {
  if (!state) return "Missing state";
  const pending = [...pendingBrowser.values()].find((item) => item.state === state);
  if (!pending) return "Unknown sign-in";
  if (error) {
    pending.error = error;
    return error;
  }
  if (!code) {
    pending.error = "No code from ChatGPT";
    return pending.error;
  }
  void exchangeOpenai(code, pending.redirectUri, pending.verifier)
    .then((session) => {
      pending.session = session;
    })
    .catch((err) => {
      pending.error = err instanceof Error ? err.message : "ChatGPT sign-in failed";
    });
  return "ok";
}

function ensureLoopback(): Promise<number> {
  if (loopback && loopbackPort) return Promise.resolve(loopbackPort);
  const ports = [1455, 1457];
  return new Promise((resolve, reject) => {
    const tryPort = (index: number) => {
      const port = ports[index];
      if (!port) {
        reject(new Error("Could not open a local callback for ChatGPT"));
        return;
      }
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
        if (url.pathname !== "/auth/callback") {
          res.writeHead(404);
          res.end();
          return;
        }
        const status = finishBrowser(
          url.searchParams.get("state"),
          url.searchParams.get("code"),
          url.searchParams.get("error"),
        );
        const ok = status === "ok";
        res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          htmlPage(
            ok ? "Signed in to ChatGPT" : "Sign-in did not finish",
            ok
              ? "You can close this tab and return to Ollama UI."
              : status.replace(/</g, "<"),
          ),
        );
      });
      server.once("error", () => tryPort(index + 1));
      server.listen(port, "127.0.0.1", () => {
        loopback = server;
        loopbackPort = port;
        resolve(port);
      });
    };
    tryPort(0);
  });
}

export async function startOAuth(provider: CloudId): Promise<OAuthStart> {
  if (provider === "openai") {
    const port = await ensureLoopback();
    const { verifier, challenge } = pkce();
    const state = crypto.randomBytes(16).toString("hex");
    const handle = crypto.randomUUID();
    const redirectUri = `http://localhost:${port}/auth/callback`;
    pendingBrowser.set(handle, { provider: "openai", verifier, state, redirectUri });
    const verificationUrl =
      `${OPENAI_ISSUER}/oauth/authorize?` +
      form({
        response_type: "code",
        client_id: OPENAI_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: OPENAI_SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
        id_token_add_organizations: "true",
        codex_cli_simplified_flow: "true",
        state,
        originator: "codex_cli_rs",
      });
    return {
      provider: "openai",
      method: "browser",
      verificationUrl,
      interval: 2,
      handle,
      pasteHint: true,
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
      method: "device",
      userCode: json.user_code,
      verificationUrl: json.verification_uri_complete || json.verification_uri || "https://auth.x.ai/device",
      interval: json.interval || 5,
      deviceCode: json.device_code,
    };
  }
  if (provider === "kimi") {
    const res = await fetch(KIMI_DEVICE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: KIMI_CLIENT_ID }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || "Kimi sign-in is not available right now");
    const json = JSON.parse(text) as {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      verification_uri_complete?: string;
      interval?: number;
    };
    if (!json.device_code || !json.user_code) throw new Error("Kimi did not return a sign-in code");
    return {
      provider: "kimi",
      method: "device",
      userCode: json.user_code,
      verificationUrl:
        json.verification_uri_complete || json.verification_uri || "https://www.kimi.com/code/authorize_device",
      interval: json.interval || 5,
      deviceCode: json.device_code,
    };
  }
  if (provider === "anthropic") {
    throw new Error(
      "Anthropic does not allow other apps to sign in with Claude.ai. Sign in at console.anthropic.com, create an API key, and paste it here.",
    );
  }
  throw new Error(
    "DeepSeek does not offer in-app sign-in. Sign in at platform.deepseek.com, create an API key, and paste it here.",
  );
}

export async function pollOAuth(body: {
  provider: OAuthProvider;
  handle?: string;
  userCode?: string;
  deviceAuthId?: string;
  deviceCode?: string;
}): Promise<{ pending: true } | { session: OAuthSession }> {
  if (body.provider === "openai") {
    if (!body.handle) throw new Error("Missing ChatGPT sign-in");
    const pending = pendingBrowser.get(body.handle);
    if (!pending) throw new Error("ChatGPT sign-in expired. Try again.");
    if (pending.error) throw new Error(pending.error);
    if (pending.session) {
      pendingBrowser.delete(body.handle);
      return { session: pending.session };
    }
    return { pending: true };
  }

  if (body.provider === "kimi") {
    if (!body.deviceCode) throw new Error("Missing Kimi sign-in state");
    const res = await fetch(KIMI_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: KIMI_CLIENT_ID,
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
    if (json.error === "authorization_pending" || json.error === "slow_down") return { pending: true };
    if (!res.ok) {
      if (/pending|slow_down/i.test(text)) return { pending: true };
      throw new Error(json.error || text || "Kimi sign-in failed");
    }
    if (!json.access_token) return { pending: true };
    return {
      session: sessionFromTokens(json.access_token, json.refresh_token || json.access_token, json.expires_in),
    };
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
  if (json.error === "authorization_pending" || json.error === "slow_down") return { pending: true };
  if (!res.ok) {
    if (!json.error || json.error === "authorization_pending") return { pending: true };
    throw new Error(json.error || text || "Grok sign-in failed");
  }
  if (!json.access_token) return { pending: true };
  return {
    session: sessionFromTokens(json.access_token, json.refresh_token || json.access_token, json.expires_in),
  };
}

export async function completeOAuth(handle: string, raw: string): Promise<OAuthSession> {
  const pending = pendingBrowser.get(handle);
  if (!pending) throw new Error("ChatGPT sign-in expired. Try Sign in again.");
  let code = raw.trim();
  let state = pending.state;
  try {
    const url = new URL(raw.trim());
    code = url.searchParams.get("code") || code;
    state = url.searchParams.get("state") || state;
  } catch {
    // pasted code only
  }
  if (state !== pending.state) throw new Error("That address does not match this sign-in. Try Sign in again.");
  const session = await exchangeOpenai(code, pending.redirectUri, pending.verifier);
  pendingBrowser.delete(handle);
  return session;
}

export async function refreshOAuth(provider: OAuthProvider, refreshToken: string): Promise<OAuthSession> {
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
  if (provider === "kimi") {
    const res = await fetch(KIMI_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: KIMI_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || "Kimi session expired. Sign in again.");
    const json = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("Kimi did not refresh the session");
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

export function oauthSupported(provider: CloudId): provider is OAuthProvider {
  return provider === "openai" || provider === "xai" || provider === "kimi";
}
