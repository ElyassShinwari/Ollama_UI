import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLOUD_ACCOUNTS, oauthNote } from "@/lib/llm/cloud";
import { useChatStore } from "@/lib/chat/store";
import type { CloudId } from "@/lib/llm/cloud";
import type { OAuthSession, Settings } from "@/lib/chat/types";

function keysFrom(settings: Settings) {
  return {
    openaiKey: settings.openaiKey,
    anthropicKey: settings.anthropicKey,
    xaiKey: settings.xaiKey,
    kimiKey: settings.kimiKey,
    deepseekKey: settings.deepseekKey,
  };
}

type Pending = {
  provider: CloudId;
  userCode?: string;
  verificationUrl: string;
  interval: number;
  handle?: string;
  deviceAuthId?: string;
  deviceCode?: string;
  pasteHint?: boolean;
};

function sessionFor(settings: Settings, id: CloudId): OAuthSession | null {
  if (id === "openai") return settings.openaiOAuth;
  if (id === "xai") return settings.xaiOAuth;
  if (id === "kimi") return settings.kimiOAuth;
  return null;
}

function saveSession(id: CloudId, session: OAuthSession | null) {
  const setSettings = useChatStore.getState().setSettings;
  if (id === "openai") setSettings({ openaiOAuth: session });
  else if (id === "xai") setSettings({ xaiOAuth: session });
  else if (id === "kimi") setSettings({ kimiOAuth: session });
}

function canOauth(id: CloudId) {
  return id === "openai" || id === "xai" || id === "kimi";
}

export function CloudConnect({ compact = false }: { compact?: boolean }) {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const [draft, setDraft] = useState(() => keysFrom(settings));
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<CloudId | null>(null);
  const [paste, setPaste] = useState("");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  function setField(setting: keyof typeof draft, value: string) {
    setDraft((cur) => ({ ...cur, [setting]: value }));
  }

  async function startSignIn(provider: CloudId) {
    if (!canOauth(provider)) {
      const account = CLOUD_ACCOUNTS.find((item) => item.id === provider);
      if (account) window.open(account.keys, "_blank", "noopener,noreferrer");
      toast.message(oauthNote(provider));
      return;
    }
    setBusy(provider);
    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", provider }),
      });
      const json = (await res.json()) as Pending & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not start sign-in");
      const next: Pending = {
        provider,
        userCode: json.userCode,
        verificationUrl: json.verificationUrl,
        interval: json.interval || 3,
        handle: json.handle,
        deviceAuthId: json.deviceAuthId,
        deviceCode: json.deviceCode,
        pasteHint: json.pasteHint,
      };
      setPending(next);
      setPaste("");
      window.open(json.verificationUrl, "_blank", "noopener,noreferrer");
      schedulePoll(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  function schedulePoll(next: Pending) {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = window.setTimeout(() => void poll(next), Math.max(2, next.interval) * 1000);
  }

  async function poll(next: Pending) {
    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "poll",
          provider: next.provider,
          handle: next.handle,
          userCode: next.userCode,
          deviceAuthId: next.deviceAuthId,
          deviceCode: next.deviceCode,
        }),
      });
      const json = (await res.json()) as { pending?: boolean; session?: OAuthSession; error?: string };
      if (!res.ok) throw new Error(json.error || "Sign-in failed");
      if (json.pending || !json.session) {
        schedulePoll(next);
        return;
      }
      saveSession(next.provider, json.session);
      setPending(null);
      const label = CLOUD_ACCOUNTS.find((item) => item.id === next.provider)?.label || next.provider;
      toast.success(json.session.email ? `Signed in to ${label} as ${json.session.email}` : `Signed in to ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setPending(null);
    }
  }

  async function finishPaste() {
    if (!pending?.handle || !paste.trim()) return;
    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", provider: pending.provider, handle: pending.handle, callback: paste.trim() }),
      });
      const json = (await res.json()) as { session?: OAuthSession; error?: string };
      if (!res.ok || !json.session) throw new Error(json.error || "Could not finish ChatGPT sign-in");
      saveSession("openai", json.session);
      setPending(null);
      setPaste("");
      toast.success(json.session.email ? `Signed in to ChatGPT as ${json.session.email}` : "Signed in to ChatGPT");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  function signOut(provider: CloudId) {
    saveSession(provider, null);
    if (pending?.provider === provider) {
      if (pollRef.current) window.clearTimeout(pollRef.current);
      setPending(null);
    }
    toast.success("Signed out");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        Sign in here for ChatGPT, Grok, and Kimi. After you approve, those models work in chat and
        in Start review. Claude and DeepSeek do not let other apps use a web login — sign in on
        their site, then paste an API key.
      </p>
      {CLOUD_ACCOUNTS.map((account) => {
        const setting = account.setting as keyof typeof draft;
        const session = sessionFor(settings, account.id);
        const waiting = pending?.provider === account.id;
        const oauth = canOauth(account.id);
        return (
          <div key={account.id} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{account.label}</Label>
              <div className="flex gap-1">
                {oauth && session?.accessToken ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => signOut(account.id)}>
                    Sign out
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void startSignIn(account.id)}
                    disabled={busy === account.id || waiting}
                  >
                    {busy === account.id || waiting ? "Waiting…" : "Sign in"}
                  </Button>
                )}
              </div>
            </div>
            {session?.accessToken ? (
              <p className="text-xs text-muted-foreground">
                Signed in{session.email ? ` as ${session.email}` : ""}. Ready for chat and review.
              </p>
            ) : waiting ? (
              <div className="rounded-lg bg-secondary px-3 py-2 text-sm">
                {pending.userCode ? (
                  <>
                    <p className="font-medium tracking-wide">{pending.userCode}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Finish sign-in in the window that opened. Enter this code if they ask for one.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Finish ChatGPT login in the window that opened. Do not use device-code settings.
                    If the browser then says it cannot connect, copy the full address from the address
                    bar and paste it below.
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-8 px-2"
                  onClick={() => window.open(pending.verificationUrl, "_blank", "noopener,noreferrer")}
                >
                  Open sign-in page again
                </Button>
                {pending.pasteHint ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={paste}
                      onChange={(e) => setPaste(e.target.value)}
                      placeholder="Paste http://localhost:1455/auth/callback?code=…"
                      autoComplete="off"
                    />
                    <Button type="button" size="sm" onClick={() => void finishPaste()} disabled={!paste.trim()}>
                      Finish
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{oauthNote(account.id)}</p>
            )}
            {!compact || !oauth || !session?.accessToken ? (
              <Input
                type="password"
                value={draft[setting]}
                onChange={(e) => setField(setting, e.target.value)}
                placeholder={oauth ? "API key (optional if you signed in)" : "API key after you sign in on their site"}
                autoComplete="off"
              />
            ) : null}
          </div>
        );
      })}
      <Button
        onClick={() => {
          setSettings({
            openaiKey: draft.openaiKey.trim(),
            anthropicKey: draft.anthropicKey.trim(),
            xaiKey: draft.xaiKey.trim(),
            kimiKey: draft.kimiKey.trim(),
            deepseekKey: draft.deepseekKey.trim(),
          });
          toast.success("Saved. Signed-in and API accounts appear in the model menu.");
        }}
      >
        Save API keys
      </Button>
    </div>
  );
}
