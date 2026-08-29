import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  askModelWorkflow,
  defaultN8nBase,
  looksLikePlaceholder,
  n8nHttpExample,
  normalizeN8nBase,
  receiveChatWorkflow,
  type N8nKind,
} from "@/lib/studio/n8n";
import { randomKey, syncStudio, useStudio } from "@/lib/studio/store";
import type { ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
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
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
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

type ProbeState = {
  ok: boolean;
  reached: boolean;
  authorized: boolean | null;
  detail?: string;
  error?: string;
};

export function N8nTab({ models }: { models: ModelRef[] }) {
  const kind = useStudio((s) => s.n8nKind);
  const baseUrl = useStudio((s) => s.n8nBaseUrl);
  const apiKey = useStudio((s) => s.n8nApiKey);
  const webhookUrl = useStudio((s) => s.n8nWebhookUrl);
  const secret = useStudio((s) => s.n8nSecret);
  const enabled = useStudio((s) => s.n8nEnabled);
  const sendOnChat = useStudio((s) => s.n8nSendOnChat);
  const defaultModel = useStudio((s) => s.defaultModel);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8080";
  const inbound = `${origin}/api/n8n`;
  const example = useMemo(
    () => n8nHttpExample(origin, secret, defaultModel),
    [origin, secret, defaultModel],
  );

  const [address, setAddress] = useState(baseUrl);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [hookDraft, setHookDraft] = useState(webhookUrl);
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [busy, setBusy] = useState<"api" | "webhook" | "list" | "ask" | "receive" | null>(null);
  const [workflows, setWorkflows] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [keyHelp, setKeyHelp] = useState(false);

  useEffect(() => setAddress(baseUrl), [baseUrl]);
  useEffect(() => setKeyDraft(apiKey), [apiKey]);
  useEffect(() => setHookDraft(webhookUrl), [webhookUrl]);

  useEffect(() => {
    if (!secret) {
      const next = randomKey().slice(0, 24);
      useStudio.getState().setStudio({ n8nSecret: next });
      void syncStudio({ n8nSecret: next });
    }
  }, [secret]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (looksLikePlaceholder(baseUrl)) return;
      void testApi(false);
    }, 400);
    return () => window.clearTimeout(id);
    // Probe when the saved address/key change, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, apiKey, kind]);

  function patch(next: Parameters<typeof syncStudio>[0]) {
    useStudio.getState().setStudio(next ?? {});
    void syncStudio(next);
  }

  function commitKind(next: N8nKind) {
    const url =
      next === kind
        ? address
        : next === "local"
          ? defaultN8nBase("local")
          : /127\.0\.0\.1|localhost/i.test(address)
            ? defaultN8nBase("cloud")
            : address;
    setAddress(url);
    setProbe(null);
    patch({ n8nKind: next, n8nBaseUrl: url });
  }

  function savedBase(): string {
    try {
      return normalizeN8nBase(address, kind);
    } catch {
      return address.trim();
    }
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
  const statusBody = probe?.detail || probe?.error || "Test the connection after n8n is open.";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground text-pretty">
        Connect n8n on this computer or on a server. n8n can ask your model, and this app can send
        finished chats into n8n. Nothing leaves until you choose a workflow or paste a webhook.
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
        <Button
          type="button"
          size="sm"
          variant={kind === "local" ? "secondary" : "outline"}
          onClick={() => commitKind("local")}
        >
          On this computer
        </Button>
        <Button
          type="button"
          size="sm"
          variant={kind === "cloud" ? "secondary" : "outline"}
          onClick={() => commitKind("cloud")}
        >
          n8n Cloud or a server
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">1. Connect n8n</h2>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
          {kind === "local" ? (
            <>
              <li>
                Open n8n on this computer. If you do not have it yet, get it from{" "}
                <a
                  className="text-foreground underline underline-offset-2"
                  href="https://n8n.io"
                  target="_blank"
                  rel="noreferrer"
                >
                  n8n.io
                </a>{" "}
                — it opens in its own browser tab.
              </li>
              <li>Leave the address as it is unless n8n shows a different one.</li>
              <li>Press Test connection. You should see “n8n is running”.</li>
              <li>
                Optional, for one-click workflows: in n8n open Settings → n8n API, create a key, paste
                it below.
              </li>
            </>
          ) : (
            <>
              <li>Open your n8n Cloud or hosted instance in the browser.</li>
              <li>
                Paste that address. A short name like acme becomes https://acme.app.n8n.cloud. If you
                copied a long page URL, that is fine — extra path is stripped.
              </li>
              <li>
                In n8n open Settings → n8n API, create a key, and paste it. Cloud and hosted n8n need
                this key.
              </li>
              <li>Press Test connection.</li>
            </>
          )}
        </ol>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label>n8n address</Label>
            <Input
              value={address}
              placeholder={defaultN8nBase(kind)}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => {
                try {
                  const next = normalizeN8nBase(address, kind);
                  setAddress(next);
                  patch({ n8nBaseUrl: next });
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
              API key {kind === "local" ? "(optional)" : "(needed for Cloud and servers)"}
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
                In n8n: the menu at the bottom left → Settings → n8n API → Create an API key. Paste it
                here. With a key, this app can add the starter workflows for you. Without a key you can
                still download a workflow file and import it in n8n.
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void testApi(true)} disabled={Boolean(busy)}>
              {busy === "api" ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Test connection
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const url = savedBase();
                if (url) window.open(url, "_blank", "noopener,noreferrer");
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
        <h2 className="font-medium">2. Let n8n ask your model</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          n8n sends a question here and gets the reply back. The easiest path: add a starter workflow,
          open it in n8n, press Test workflow.
        </p>
        {kind === "cloud" ? (
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            n8n Cloud is on the public internet. It can only ask a model on this computer if this app
            has a public address. Sending chats into n8n Cloud (step 3) works without that.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            On this computer n8n should call the URL below as shown.
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <DefaultModelSelect models={models} />
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
                  askModelWorkflow({ origin, secret, model: defaultModel }),
                );
                toast.message("Import in n8n: three dots on Workflows → Import from File. Then press Test workflow.");
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
              <li>Method POST, URL below, header x-n8n-secret with the secret.</li>
              <li>
                JSON body: {`{ "message": "your text" }`}. The reply is in the JSON field{" "}
                <span className="font-mono text-foreground">reply</span>.
              </li>
            </ol>
            <div className="mt-3 flex flex-col gap-3">
              <CopyField label="URL for the HTTP Request node" value={inbound} />
              <div className="flex flex-col gap-2">
                <Label>Shared secret</Label>
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
        <h2 className="font-medium">3. Send chats into n8n</h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          When a reply finishes here, n8n can email it, save it, or continue a workflow. Chat stays
          fast — the ping is sent in the background.
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground text-pretty">
          <li>Add the receive workflow below, or in n8n add a Webhook node (method POST) and copy its production URL.</li>
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
                toast.message("Import in n8n, turn the workflow on, then copy the Webhook node’s production URL.");
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
