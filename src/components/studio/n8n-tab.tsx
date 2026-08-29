import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, LoaderCircle, Monitor, Server, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DOCKER_N8N_CMD,
  NPX_N8N_CMD,
  askModelWorkflow,
  cloudInstanceName,
  defaultN8nBase,
  looksLikePlaceholder,
  n8nAddressPlaceholder,
  n8nConnectionText,
  n8nHttpExample,
  n8nKindFromBase,
  n8nOllamaConnection,
  n8nReachableFromDocker,
  n8nSelfHostedConnection,
  normalizeN8nBase,
  receiveChatWorkflow,
  type N8nConnection,
  type N8nKind,
} from "@/lib/studio/n8n";
import { randomKey, syncStudio, useStudio } from "@/lib/studio/store";
import type { ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

function CopyField({
  label,
  value,
  hint,
  emptyLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  emptyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shown = value || emptyLabel || "";
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={shown}
          className="min-w-0 flex-1 font-mono text-xs"
          placeholder={emptyLabel}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 px-3"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  );
}

function ConnectionOutput({
  conn,
  dockerUrl,
}: {
  conn: N8nConnection;
  dockerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const block = n8nConnectionText(conn);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3">
      <CopyField label="Provider" value={conn.provider} />
      <CopyField label="Base URL" value={conn.baseUrl} />
      <CopyField
        label="API key"
        value={conn.apiKey}
        emptyLabel="leave blank"
        hint={conn.apiKey ? undefined : "Leave this empty in n8n for local Ollama."}
      />
      <CopyField
        label="Model"
        value={conn.model}
        emptyLabel="choose a model above"
      />
      {dockerUrl && dockerUrl !== conn.baseUrl ? (
        <CopyField
          label="Base URL if n8n is in Docker"
          value={dockerUrl}
          hint="Docker cannot reach 127.0.0.1 on this computer. Use this instead."
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={async () => {
          await navigator.clipboard.writeText(block);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied all four fields" : "Copy all"}
      </Button>
    </div>
  );
}

function CopyCommand({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-xs leading-5">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}

function DefaultModelSelect({ models }: { models: ModelRef[] }) {
  const value = useStudio((s) => s.defaultModel);
  const local = models.filter((m) => m.provider === "ollama");
  return (
    <div className="flex flex-col gap-2">
      <Label>Model n8n should talk to</Label>
      <select
        className="h-11 rounded-md border border-input bg-transparent px-3 text-sm"
        value={value}
        onChange={(e) => {
          useStudio.getState().setStudio({ defaultModel: e.target.value });
          void syncStudio({ defaultModel: e.target.value });
        }}
      >
        <option value="">Choose a local Ollama model…</option>
        {local.map((m) => (
          <option key={`${m.provider}:${m.id}`} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {local.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Install a local model first. n8n calls that model through this app.
        </p>
      ) : null}
    </div>
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PLACES: { id: N8nKind; title: string; body: string; icon: typeof Monitor }[] = [
  {
    id: "local",
    title: "This computer",
    body: "n8n running next to this app. We look for it on port 5678.",
    icon: Monitor,
  },
  {
    id: "cloud",
    title: "n8n Cloud",
    body: "Your workspace at name.app.n8n.cloud.",
    icon: Workflow,
  },
  {
    id: "server",
    title: "A server",
    body: "Docker, a VPS, or n8n on your own domain.",
    icon: Server,
  },
];

type ProbeState = {
  ok: boolean;
  reached: boolean;
  authorized: boolean | null;
  detail?: string;
  error?: string;
  base?: string;
};

export function N8nTab({ models }: { models: ModelRef[] }) {
  const kind = useStudio((s) => s.n8nKind);
  const baseUrl = useStudio((s) => s.n8nBaseUrl);
  const apiKey = useStudio((s) => s.n8nApiKey);
  const webhookUrl = useStudio((s) => s.n8nWebhookUrl);
  const secret = useStudio((s) => s.n8nSecret);
  const appApiKey = useStudio((s) => s.apiKey);
  const apiEnabled = useStudio((s) => s.apiEnabled);
  const ollamaHost = useStudio((s) => s.ollamaHost);
  const enabled = useStudio((s) => s.n8nEnabled);
  const sendOnChat = useStudio((s) => s.n8nSendOnChat);
  const defaultModel = useStudio((s) => s.defaultModel);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8080";
  const inbound = `${origin}/api/n8n`;
  const example = useMemo(
    () => n8nHttpExample(origin, secret, defaultModel, appApiKey),
    [origin, secret, defaultModel, appApiKey],
  );

  const [address, setAddress] = useState(baseUrl);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [hookDraft, setHookDraft] = useState(webhookUrl);
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [busy, setBusy] = useState<"api" | "scan" | "webhook" | "list" | "ask" | "receive" | null>(
    null,
  );
  const [workflows, setWorkflows] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [keyHelp, setKeyHelp] = useState(kind !== "local");
  const [startHelp, setStartHelp] = useState(true);
  const [connKind, setConnKind] = useState<"app" | "ollama">("app");

  useEffect(() => setAddress(baseUrl), [baseUrl]);
  useEffect(() => setKeyDraft(apiKey), [apiKey]);
  useEffect(() => setHookDraft(webhookUrl), [webhookUrl]);

  useEffect(() => {
    if (!secret) {
      const next = randomKey().slice(0, 24);
      useStudio.getState().setStudio({ n8nSecret: next });
      void syncStudio({ n8nSecret: next });
    }
    if (!appApiKey) {
      const next = randomKey();
      useStudio.getState().setStudio({ apiKey: next });
      void syncStudio({ apiKey: next });
    }
  }, [secret, appApiKey]);

  useEffect(() => {
    if (kind === "local" && n8nKindFromBase(baseUrl) !== "local" && !looksLikePlaceholder(baseUrl)) {
      const inferred = n8nKindFromBase(baseUrl);
      if (inferred !== kind) useStudio.getState().setStudio({ n8nKind: inferred });
    }
  }, [baseUrl, kind]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (kind === "local") {
        void findLocal(false);
        return;
      }
      if (looksLikePlaceholder(baseUrl)) return;
      void testApi(false);
    }, 350);
    return () => window.clearTimeout(id);
    // Probe when the saved address/key change, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, apiKey, kind]);

  function patch(next: Parameters<typeof syncStudio>[0]) {
    useStudio.getState().setStudio(next ?? {});
    void syncStudio(next);
  }

  function commitKind(next: N8nKind) {
    let url = address;
    try {
      const normalized = normalizeN8nBase(address, next);
      const inferred = n8nKindFromBase(normalized);
      const keep = inferred === next && address.trim() && !looksLikePlaceholder(normalized);
      url = keep ? normalized : defaultN8nBase(next);
    } catch {
      url = defaultN8nBase(next);
    }
    setAddress(url);
    setProbe(null);
    setKeyHelp(next !== "local");
    setStartHelp(next === "local");
    patch({ n8nKind: next, n8nBaseUrl: url });
  }

  function savedBase(): string {
    try {
      return normalizeN8nBase(address, kind);
    } catch {
      return address.trim();
    }
  }

  function displayAddress(): string {
    if (looksLikePlaceholder(address)) return "";
    if (kind === "cloud") {
      const name = cloudInstanceName(address);
      return name || address;
    }
    return address;
  }

  async function testApi(showToast = true) {
    setBusy("api");
    let normalized = address.trim();
    try {
      normalized = normalizeN8nBase(address, kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bad n8n address";
      setProbe({ ok: false, reached: false, authorized: null, error: msg });
      if (showToast) toast.error(msg);
      setBusy(null);
      return;
    }
    setAddress(normalized);
    patch({ n8nBaseUrl: normalized, n8nApiKey: keyDraft.trim(), n8nKind: kind });
    try {
      const res = await fetch("/api/n8n/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "api",
          baseUrl: normalized,
          apiKey: keyDraft,
          n8nKind: kind,
        }),
      });
      const json = (await res.json()) as ProbeState;
      setProbe(json);
      if (json.ok) {
        if (json.base) setAddress(json.base);
        if (showToast) toast.success(json.detail || "Connected to n8n");
        if (keyDraft.trim()) void loadWorkflows(false);
      } else if (showToast) {
        toast.error(json.error || "Could not reach n8n");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach n8n";
      setProbe({ ok: false, reached: false, authorized: null, error: msg });
      if (showToast) toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function findLocal(showToast = true) {
    setBusy("scan");
    try {
      const res = await fetch("/api/n8n/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "scan",
          baseUrl: address,
          n8nKind: "local",
        }),
      });
      const json = (await res.json()) as ProbeState;
      setProbe(json);
      if (json.ok && json.base) {
        setAddress(json.base);
        patch({ n8nBaseUrl: json.base, n8nKind: "local" });
        setStartHelp(false);
        if (showToast) toast.success(json.detail || "Found n8n on this computer");
        if (keyDraft.trim()) void loadWorkflows(false);
      } else {
        setStartHelp(true);
        if (showToast) toast.error(json.error || "n8n is not running here yet");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not look for n8n";
      setProbe({ ok: false, reached: false, authorized: null, error: msg });
      setStartHelp(true);
      if (showToast) toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function testWebhook() {
    const url = hookDraft.trim();
    if (!url) {
      toast.error("Paste the webhook URL from n8n first");
      return;
    }
    setBusy("webhook");
    patch({ n8nWebhookUrl: url });
    try {
      const res = await fetch("/api/n8n/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "webhook", webhookUrl: url }),
      });
      const json = (await res.json()) as { ok?: boolean; detail?: string; error?: string };
      if (!json.ok) throw new Error(json.error || "Webhook did not accept the ping");
      toast.success(json.detail || "n8n received the ping");
      setProbe((cur) => ({
        ok: true,
        reached: cur?.reached ?? true,
        authorized: cur?.authorized ?? null,
        detail: json.detail,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook failed");
    } finally {
      setBusy(null);
    }
  }

  async function loadWorkflows(showEmpty = true) {
    setBusy("list");
    try {
      await syncStudio({ n8nBaseUrl: savedBase(), n8nApiKey: keyDraft.trim() });
      const res = await fetch("/api/n8n/workflows", { cache: "no-store" });
      const json = (await res.json()) as {
        workflows?: { id: string; name: string; active: boolean }[];
        error?: string;
        hint?: string;
      };
      if (json.error) throw new Error(json.error);
      setWorkflows(json.workflows ?? []);
      if (showEmpty && json.hint && !(json.workflows ?? []).length) toast.message(json.hint);
    } catch (err) {
      if (showEmpty) toast.error(err instanceof Error ? err.message : "Could not list workflows");
    } finally {
      setBusy(null);
    }
  }

  async function addWorkflow(which: "ask" | "receive") {
    if (!keyDraft.trim()) {
      toast.error("Paste an n8n API key first — then this app can add the workflow for you.");
      setKeyHelp(true);
      return;
    }
    if (which === "ask" && !defaultModel) {
      toast.error("Choose a local model n8n should talk to.");
      return;
    }
    setBusy(which);
    try {
      await syncStudio({
        n8nBaseUrl: savedBase(),
        n8nApiKey: keyDraft.trim(),
        n8nEnabled: true,
        n8nSecret: secret,
        defaultModel,
      });
      const res = await fetch("/api/n8n/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: which, origin }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        webhookUrl?: string;
        hint?: string;
        error?: string;
        reused?: boolean;
      };
      if (!json.ok) throw new Error(json.error || "Could not add the workflow");
      if (json.webhookUrl) {
        setHookDraft(json.webhookUrl);
        patch({ n8nWebhookUrl: json.webhookUrl, n8nSendOnChat: true });
      }
      toast.success(json.hint || "Added in n8n");
      void loadWorkflows(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the workflow");
    } finally {
      setBusy(null);
    }
  }

  const connected = Boolean(probe?.ok && probe.reached);
  const authorized = probe?.authorized === true;
  const statusTitle = !probe
    ? "Not connected yet"
    : connected && authorized
      ? "Connected to n8n"
      : connected
        ? "n8n is running"
        : "Could not reach n8n";
  const statusBody =
    probe?.detail ||
    probe?.error ||
    (kind === "local"
      ? "Press Find n8n after it is open on this computer."
      : "Enter the address, paste an API key, then press Connect.");
  const needsKey = kind !== "local";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground text-pretty">
        Connect n8n on this computer, on n8n Cloud, or on your own server. After that, n8n can ask
        your local model, and finished chats can continue into n8n — Slack, email, a sheet, anything
        n8n already does.
      </p>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-full",
            connected ? "bg-ready" : "bg-muted-foreground/35",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-medium">{statusTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{statusBody}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">1. Where is n8n?</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLACES.map((place) => {
            const Icon = place.icon;
            const active = kind === place.id;
            return (
              <button
                key={place.id}
                type="button"
                aria-label={place.title}
                aria-pressed={active}
                onClick={() => commitKind(place.id)}
                className={cn(
                  "flex min-h-11 flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-start transition-colors",
                  active
                    ? "border-ring bg-card ring-1 ring-ring/40"
                    : "border-border bg-transparent hover:bg-accent",
                )}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="font-medium">{place.title}</span>
                <span className="text-xs text-muted-foreground text-pretty">{place.body}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">2. Connect</h2>
        {kind === "local" ? (
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
            <li>
              If n8n is not installed yet, get it from{" "}
              <a
                className="text-foreground underline underline-offset-2"
                href="https://n8n.io"
                target="_blank"
                rel="noreferrer"
              >
                n8n.io
              </a>
              , or start it with one of the commands below.
            </li>
            <li>When it is ready it opens in a browser tab, usually at http://127.0.0.1:5678.</li>
            <li>Come back here and press Find n8n. That is enough to talk to it.</li>
            <li>
              Optional: in n8n open Settings → n8n API, create a key, and paste it so this app can
              add starter workflows for you.
            </li>
          </ol>
        ) : kind === "cloud" ? (
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
            <li>
              Open{" "}
              <a
                className="text-foreground underline underline-offset-2"
                href="https://app.n8n.cloud"
                target="_blank"
                rel="noreferrer"
              >
                n8n Cloud
              </a>{" "}
              and sign in.
            </li>
            <li>
              Type the instance name from the address bar — acme if you see
              https://acme.app.n8n.cloud — or paste the whole address.
            </li>
            <li>
              In n8n: the menu at the bottom left → Settings → n8n API → Create an API key. Paste it
              below.
            </li>
            <li>Press Connect.</li>
          </ol>
        ) : (
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
            <li>Open your hosted n8n in the browser (Docker, a VPS, or your own domain).</li>
            <li>Paste that same address. Extra path after /home or /workflow is stripped.</li>
            <li>In n8n: Settings → n8n API → Create an API key. Paste it below.</li>
            <li>Press Connect.</li>
          </ol>
        )}

        {kind === "local" && startHelp ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-3">
            <p className="text-sm font-medium">Start n8n on this computer</p>
            <p className="text-xs text-muted-foreground">In a terminal, run one of these, then press Find n8n.</p>
            <CopyCommand value={NPX_N8N_CMD} />
            <CopyCommand value={DOCKER_N8N_CMD} />
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>{kind === "cloud" ? "Instance name or address" : "n8n address"}</Label>
            <Input
              value={displayAddress()}
              placeholder={n8nAddressPlaceholder(kind)}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => {
                if (!address.trim()) return;
                try {
                  const next = normalizeN8nBase(address, kind);
                  const inferred = n8nKindFromBase(next);
                  setAddress(next);
                  patch({
                    n8nBaseUrl: next,
                    n8nKind: inferred === kind ? kind : inferred,
                  });
                } catch {
                  patch({ n8nBaseUrl: address.trim() });
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="text-start text-sm font-medium"
              onClick={() => setKeyHelp((v) => !v)}
            >
              API key {needsKey ? "(needed)" : "(optional — lets this app add workflows)"}
            </button>
            <Input
              type="password"
              value={keyDraft}
              placeholder="n8n_api_…"
              autoComplete="off"
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => patch({ n8nApiKey: keyDraft.trim() })}
            />
            {keyHelp ? (
              <p className="text-xs text-muted-foreground text-pretty">
                In n8n: the menu at the bottom left → Settings → n8n API → Create an API key. Give it
                a label, copy it once, and paste it here. Without a key you can still download a
                workflow file and import it in n8n.
              </p>
            ) : (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setKeyHelp(true)}
              >
                Where do I find this?
              </button>
            )}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={enabled}
              onChange={(e) => patch({ n8nEnabled: e.target.checked })}
            />
            Allow n8n to talk to this app
          </label>
          <div className="flex flex-wrap gap-2">
            {kind === "local" ? (
              <Button type="button" onClick={() => void findLocal(true)} disabled={Boolean(busy)}>
                {busy === "scan" ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Find n8n
              </Button>
            ) : null}
            <Button
              type="button"
              variant={kind === "local" ? "outline" : "default"}
              onClick={() => void testApi(true)}
              disabled={Boolean(busy)}
            >
              {busy === "api" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {connected ? "Test again" : "Connect"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const url = savedBase();
                if (url && !looksLikePlaceholder(url)) window.open(url, "_blank", "noopener,noreferrer");
                else window.open("https://n8n.io", "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="size-4" />
              Open n8n
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadWorkflows(true)}
              disabled={Boolean(busy) || !keyDraft.trim()}
            >
              {busy === "list" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              List workflows
            </Button>
          </div>
        </div>
        {workflows.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {workflows.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{w.name}</span>
                <span className={cn("text-xs", w.active ? "text-ready" : "text-muted-foreground")}>
                  {w.active ? "On" : "Off"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">3. Let n8n ask your model</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          n8n calls your local model with a fast API key. Those calls skip the chat window, so a busy
          workflow does not freeze this app. If you are chatting, n8n waits and retries until you are
          free.
        </p>
        {kind === "cloud" ? (
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            n8n Cloud is on the public internet. It can only ask a model on this computer if this
            app has a public address. Sending chats into n8n Cloud (step 4) works without that.
          </p>
        ) : kind === "server" ? (
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            The server must be able to reach this app’s address. If they are on different machines,
            use a public URL or a tunnel for step 3. Sending chats into n8n (step 4) only needs the
            webhook.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            On this computer n8n should call the URL below with the API key.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <DefaultModelSelect models={models} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Connection for n8n</p>
            <p className="text-sm text-muted-foreground text-pretty">
              Paste these into n8n when it asks for a provider, base URL, API key, and model. Chat
              Model nodes, AI Agent, and OpenAI-compatible credentials all use this.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={connKind === "app" ? "default" : "outline"}
                onClick={() => setConnKind("app")}
              >
                Through this app
              </Button>
              <Button
                type="button"
                variant={connKind === "ollama" ? "default" : "outline"}
                onClick={() => setConnKind("ollama")}
              >
                Direct Ollama
              </Button>
            </div>
            {connKind === "app" ? (
              <>
                <p className="text-xs text-muted-foreground text-pretty">
                  Provider: Self-hosted. n8n talks to this app’s OpenAI-style API, so a busy
                  workflow waits if you are chatting.
                </p>
                {!apiEnabled ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={apiEnabled}
                      onChange={(e) => patch({ apiEnabled: e.target.checked })}
                    />
                    Turn on the local API (needed for this connection)
                  </label>
                ) : null}
                <ConnectionOutput
                  conn={n8nSelfHostedConnection({
                    origin,
                    apiKey: appApiKey || secret,
                    model: defaultModel,
                  })}
                  dockerUrl={n8nReachableFromDocker(`${origin}/api/v1`)}
                />
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground text-pretty">
                  Provider: Ollama. Leave the API key blank. n8n talks to Ollama on this computer.
                </p>
                <ConnectionOutput
                  conn={n8nOllamaConnection({ ollamaHost, model: defaultModel })}
                  dockerUrl={n8nReachableFromDocker(ollamaHost || "http://127.0.0.1:11434")}
                />
              </>
            )}
          </div>
          <CopyField label="Fast API key for n8n HTTP Request" value={appApiKey || secret} />
          <CopyField label="URL n8n should POST to" value={inbound} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void addWorkflow("ask")}
              disabled={Boolean(busy) || !enabled}
            >
              {busy === "ask" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Add this workflow in n8n
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                downloadJson(
                  "ollama-ui-ask-n8n.json",
                  askModelWorkflow({ origin, secret, model: defaultModel, apiKey: appApiKey }),
                );
                toast.message(
                  "Import in n8n: three dots on Workflows → Import from File. Then press Test workflow.",
                );
              }}
            >
              <Download className="size-4" />
              Download workflow
            </Button>
          </div>
          <details className="rounded-xl border border-border px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
              Wire an HTTP Request node yourself
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
              <li>In n8n add an HTTP Request node.</li>
              <li>
                Method POST, URL below, header Authorization: Bearer with the fast API key. Turn on
                retry so n8n waits if you are chatting.
              </li>
              <li>
                JSON body: {`{ "message": "your text" }`}. The reply is in the JSON field{" "}
                <span className="font-mono text-foreground">reply</span>.
              </li>
            </ol>
            <div className="mt-3 flex flex-col gap-3">
              <CopyField label="URL for the HTTP Request node" value={inbound} />
              <CopyField label="Authorization Bearer token" value={appApiKey || secret} />
              <div className="flex flex-col gap-2">
                <Label>Shared secret (also accepted)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={secret} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0"
                    onClick={() => patch({ n8nSecret: randomKey().slice(0, 24) })}
                  >
                    Rotate
                  </Button>
                </div>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-secondary p-3 font-mono text-xs leading-5">
                {example}
              </pre>
            </div>
          </details>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">4. Send chats into n8n</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          When a reply finishes here, n8n can email it, save it, or continue a workflow. Chat stays
          fast — the ping is sent in the background.
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
          <li>
            Add the receive workflow below, or in n8n add a Webhook node (method POST) and copy its
            production URL.
          </li>
          <li>Turn the workflow on in n8n (toggle at the top right).</li>
          <li>Turn on “Send each finished reply”, then send a test ping.</li>
        </ol>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void addWorkflow("receive")}
              disabled={Boolean(busy) || !enabled}
            >
              {busy === "receive" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Add receive workflow in n8n
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                downloadJson("ollama-ui-receive-n8n.json", receiveChatWorkflow());
                toast.message(
                  "Import in n8n, turn the workflow on, then copy the Webhook node’s production URL.",
                );
              }}
            >
              <Download className="size-4" />
              Download workflow
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Webhook URL from n8n</Label>
            <Input
              value={hookDraft}
              placeholder="https://…/webhook/ollama-ui-chat"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setHookDraft(e.target.value)}
              onBlur={() => patch({ n8nWebhookUrl: hookDraft.trim() })}
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={sendOnChat}
              onChange={(e) => patch({ n8nSendOnChat: e.target.checked })}
            />
            Send each finished reply to this webhook
          </label>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => void testWebhook()}
            disabled={Boolean(busy) || !hookDraft.trim()}
          >
            {busy === "webhook" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Send a test ping
          </Button>
        </div>
      </section>
    </div>
  );
}
