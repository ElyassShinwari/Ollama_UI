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
  provider: "openai" | "xai";
  userCode: string;
  verificationUrl: string;
  interval: number;
  deviceAuthId?: string;
  deviceCode?: string;
};

function sessionFor(settings: Settings, id: CloudId): OAuthSession | null {
  if (id === "openai") return settings.openaiOAuth;
  if (id === "xai") return settings.xaiOAuth;
  return null;
}

export function CloudConnect({ compact = false }: { compact?: boolean }) {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const [draft, setDraft] = useState(() => keysFrom(settings));
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<CloudId | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  function setField(setting: keyof typeof draft, value: string) {
    setDraft((cur) => ({ ...cur, [setting]: value }));
  }

  async function startSignIn(provider: "openai" | "xai") {
    setBusy(provider);
    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", provider }),
      });
      const json = (await res.json()) as Pending & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not start sign-in");
      setPending({
        provider,
        userCode: json.userCode,
        verificationUrl: json.verificationUrl,
        interval: json.interval || 5,
        deviceAuthId: json.deviceAuthId,
        deviceCode: json.deviceCode,
      });
      window.open(json.verificationUrl, "_blank", "noopener,noreferrer");
      schedulePoll({
        provider,
        userCode: json.userCode,
        verificationUrl: json.verificationUrl,
        interval: json.interval || 5,
        deviceAuthId: json.deviceAuthId,
        deviceCode: json.deviceCode,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  function schedulePoll(next: Pending) {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = window.setTimeout(() => void poll(next), Math.max(3, next.interval) * 1000);
  }

  async function poll(next: Pending) {
    try {
      const res = await fetch("/api/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "poll",
          provider: next.provider,
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
      if (next.provider === "openai") setSettings({ openaiOAuth: json.session });
      else setSettings({ xaiOAuth: json.session });
      setPending(null);
      toast.success(
        json.session.email
          ? `Signed in to ${next.provider === "openai" ? "ChatGPT" : "Grok"} as ${json.session.email}`
          : `Signed in to ${next.provider === "openai" ? "ChatGPT" : "Grok"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setPending(null);
    }
  }

  function signOut(provider: "openai" | "xai") {
    if (provider === "openai") setSettings({ openaiOAuth: null });
    else setSettings({ xaiOAuth: null });
    if (pending?.provider === provider) {
      if (pollRef.current) window.clearTimeout(pollRef.current);
      setPending(null);
    }
    toast.success("Signed out");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        Sign in inside this app for ChatGPT and Grok. After you approve in their window, those
        models work here — including as the writer or tester in a review. Claude, Kimi, and DeepSeek
        do not allow other apps to use a web login, so they need an API key.
      </p>
      {CLOUD_ACCOUNTS.map((account) => {
        const setting = account.setting as keyof typeof draft;
        const session = sessionFor(settings, account.id);
        const waiting = pending?.provider === account.id;
        const canOauth = account.id === "openai" || account.id === "xai";
        return (
          <div key={account.id} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{account.label}</Label>
              <div className="flex gap-1">
                {canOauth ? (
                  session?.accessToken ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => signOut(account.id as "openai" | "xai")}>
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void startSignIn(account.id as "openai" | "xai")}
                      disabled={busy === account.id || waiting}
                    >
                      {busy === account.id || waiting ? "Waiting…" : "Sign in"}
                    </Button>
                  )
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(account.keys, "_blank", "noopener,noreferrer")}
                  >
                    Get API key
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
                <p className="font-medium tracking-wide">{pending.userCode}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Finish sign-in in the window that opened. Enter this code if they ask for one.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-8 px-2"
                  onClick={() => window.open(pending.verificationUrl, "_blank", "noopener,noreferrer")}
                >
                  Open sign-in page again
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{oauthNote(account.id)}</p>
            )}
            {!compact || !canOauth || !session?.accessToken ? (
              <Input
                type="password"
                value={draft[setting]}
                onChange={(e) => setField(setting, e.target.value)}
                placeholder="API key (optional if you signed in)"
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
