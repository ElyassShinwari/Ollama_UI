import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLOUD_ACCOUNTS, oauthNote } from "@/lib/llm/cloud";
import { parseModelList, sanitizeCompatBase } from "@/lib/llm/custom";
import { useChatStore } from "@/lib/chat/store";
import { t } from "@/lib/i18n";
import type { CloudId } from "@/lib/llm/cloud";
import type { CustomEndpoint, OAuthSession, Settings } from "@/lib/chat/types";

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
  const locale = settings.locale;
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
    setDraft((cur) => {
      const next = { ...cur, [setting]: value };
      useChatStore.getState().setSettings({
        openaiKey: next.openaiKey,
        anthropicKey: next.anthropicKey,
        xaiKey: next.xaiKey,
        kimiKey: next.kimiKey,
        deepseekKey: next.deepseekKey,
      });
      return next;
    });
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
      if (!res.ok) throw new Error(json.error || t(locale, "couldNotStartSignIn"));
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
      toast.error(err instanceof Error ? err.message : t(locale, "signInFailed"));
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
      if (!res.ok) throw new Error(json.error || t(locale, "signInFailed"));
      if (json.pending || !json.session) {
        schedulePoll(next);
        return;
      }
      saveSession(next.provider, json.session);
      setPending(null);
      const label = CLOUD_ACCOUNTS.find((item) => item.id === next.provider)?.label || next.provider;
      toast.success(
        json.session.email
          ? t(locale, "signedInAs", { label, email: json.session.email })
          : t(locale, "signedIn", { label }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(locale, "signInFailed");
      if (/fetch|network|Failed to fetch|timeout/i.test(msg)) {
        schedulePoll(next);
        return;
      }
      toast.error(msg);
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
      if (!res.ok || !json.session) throw new Error(json.error || t(locale, "couldNotFinishSignIn"));
      saveSession("openai", json.session);
      setPending(null);
      setPaste("");
      toast.success(
        json.session.email
          ? t(locale, "signedInAs", { label: "ChatGPT", email: json.session.email })
          : t(locale, "signedIn", { label: "ChatGPT" }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "signInFailed"));
    }
  }

  function signOut(provider: CloudId) {
    saveSession(provider, null);
    if (pending?.provider === provider) {
      if (pollRef.current) window.clearTimeout(pollRef.current);
      setPending(null);
    }
    toast.success(t(locale, "signedOut"));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        {t(locale, "cloudConnectLead")}
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
                  <Button type="button" size="sm" variant="ghost" className="min-h-11 md:h-8" onClick={() => signOut(account.id)}>
                    {t(locale, "signOut")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 md:h-8"
                    onClick={() => void startSignIn(account.id)}
                    disabled={busy === account.id || waiting}
                  >
                    {busy === account.id || waiting ? t(locale, "waiting") : t(locale, "signIn")}
                  </Button>
                )}
              </div>
            </div>
            {session?.accessToken ? (
              <p className="text-xs text-muted-foreground">
                {session.email
                  ? t(locale, "signedInReadyAs", { email: session.email })
                  : t(locale, "signedInReady")}
              </p>
            ) : waiting ? (
              <div className="rounded-lg bg-secondary px-3 py-2 text-sm">
                {pending.userCode ? (
                  <>
                    <p className="font-medium tracking-wide">{pending.userCode}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(locale, "enterDeviceCode")}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t(locale, "chatgptPasteHint")}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-8 px-2"
                  onClick={() => window.open(pending.verificationUrl, "_blank", "noopener,noreferrer")}
                >
                  {t(locale, "openSignInAgain")}
                </Button>
                {pending.pasteHint ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={paste}
                      onChange={(e) => setPaste(e.target.value)}
                      placeholder={t(locale, "pasteCallbackPh")}
                      autoComplete="off"
                    />
                    <Button type="button" size="sm" onClick={() => void finishPaste()} disabled={!paste.trim()}>
                      {t(locale, "finish")}
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
                placeholder={oauth ? t(locale, "apiKeyOptional") : t(locale, "apiKeyAfter")}
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
          toast.success(t(locale, "cloudSaved"));
        }}
      >
        {t(locale, "saveApiKeys")}
      </Button>
      <RemoteEndpoints compact={compact} />
    </div>
  );
}

function RemoteEndpoints({ compact = false }: { compact?: boolean }) {
  const locale = useChatStore((s) => s.settings.locale);
  const endpoints = useChatStore((s) => s.settings.customEndpoints) ?? [];
  const setSettings = useChatStore((s) => s.setSettings);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  function save(next: CustomEndpoint[]) {
    setSettings({ customEndpoints: next });
  }

  async function add() {
    let base: string;
    try {
      base = sanitizeCompatBase(baseUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "remoteNeedUrl"));
      return;
    }
    const typed = parseModelList(model);
    setBusy(true);
    let listed: string[] = [];
    let loadError = "";
    try {
      const res = await fetch("/api/custom-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: base, apiKey }),
      });
      const json = (await res.json()) as { models?: string[]; error?: string };
      listed = (json.models ?? []).filter(Boolean);
      if (json.error) loadError = json.error;
    } catch (err) {
      loadError = err instanceof Error ? err.message : t(locale, "remoteLoadFailed");
    } finally {
      setBusy(false);
    }
    const models = [...new Set([...typed, ...listed])];
    if (models.length === 0) {
      toast.error(loadError || t(locale, "remoteNeedModel"));
      return;
    }
    const endpoint: CustomEndpoint = {
      id: crypto.randomUUID(),
      name: name.trim() || new URL(base).host,
      baseUrl: base,
      apiKey: apiKey.trim(),
      models,
    };
    save([...endpoints, endpoint]);
    setName("");
    setBaseUrl("");
    setApiKey("");
    setModel("");
    toast.success(t(locale, "remoteSaved"));
    if (loadError && typed.length) toast.message(loadError);
  }

  async function loadMore(endpoint: CustomEndpoint) {
    setBusy(true);
    try {
      const res = await fetch("/api/custom-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: endpoint.baseUrl, apiKey: endpoint.apiKey }),
      });
      const json = (await res.json()) as { models?: string[]; error?: string };
      const listed = (json.models ?? []).filter(Boolean);
      if (!listed.length) {
        toast.error(json.error || t(locale, "remoteLoadFailed"));
        return;
      }
      save(
        endpoints.map((item) =>
          item.id === endpoint.id
            ? { ...item, models: [...new Set([...item.models, ...listed])] }
            : item,
        ),
      );
      toast.success(t(locale, "remoteSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "remoteLoadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p className="font-medium">{t(locale, "remoteApis")}</p>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">{t(locale, "remoteApisBlurb")}</p>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-col gap-1">
          <Label>{t(locale, "remoteName")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, "remoteNamePh")} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t(locale, "remoteBaseUrl")}</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t(locale, "remoteBaseUrlPh")} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t(locale, "remoteApiKey")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t(locale, "remoteApiKeyPh")}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t(locale, "remoteModel")}</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t(locale, "remoteModelPh")} autoComplete="off" />
        </div>
      </div>
      <Button type="button" className="min-h-11" onClick={() => void add()} disabled={busy || !baseUrl.trim()}>
        {busy ? t(locale, "waiting") : t(locale, "addRemote")}
      </Button>
      {endpoints.length === 0 ? (
        compact ? null : <p className="text-xs text-muted-foreground">{t(locale, "noRemoteYet")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {endpoints.map((item) => (
            <div key={item.id} className="rounded-xl border border-border px-3 py-3">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.baseUrl}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{item.models.join(", ")}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => void loadMore(item)}>
                    {t(locale, "loadRemoteModels")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => {
                      save(endpoints.filter((row) => row.id !== item.id));
                      toast.success(t(locale, "remoteRemoved", { name: item.name }));
                    }}
                  >
                    {t(locale, "delete")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
