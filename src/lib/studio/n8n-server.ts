import {
  RECEIVE_WEBHOOK_PATH,
  LOCAL_N8N_CANDIDATES,
  askModelWorkflow,
  looksLikeN8nPage,
  looksLikePlaceholder,
  n8nApiUrl,
  n8nWebhookUrl,
  normalizeN8nBase,
  placeholderError,
  receiveChatWorkflow,
  sanitizeN8nBase,
  unreachableError,
  webhookPathFromNodes,
  type N8nKind,
  type N8nWorkflowFile,
} from "./n8n";

const TIMEOUT_MS = 8000;

export type N8nProbe = {
  ok: boolean;
  reached: boolean;
  authorized: boolean | null;
  workflows?: number;
  detail: string;
  error?: string;
  base: string;
};

function headers(apiKey?: string): Record<string, string> {
  const out: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) out["X-N8N-API-KEY"] = apiKey.trim();
  return out;
}

async function fetchN8n(url: string, init: RequestInit = {}, ms = TIMEOUT_MS) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

export async function probeN8n(opts: {
  baseUrl: string;
  apiKey?: string;
  kind?: N8nKind;
  timeoutMs?: number;
  skipApi?: boolean;
}): Promise<N8nProbe> {
  const kind = opts.kind ?? "local";
  const ms = opts.timeoutMs ?? TIMEOUT_MS;
  let base: string;
  try {
    base = normalizeN8nBase(opts.baseUrl || "", kind);
  } catch (err) {
    return {
      ok: false,
      reached: false,
      authorized: null,
      base: opts.baseUrl,
      detail: "",
      error: err instanceof Error ? err.message : "Bad n8n address",
    };
  }
  if (looksLikePlaceholder(base)) {
    return {
      ok: false,
      reached: false,
      authorized: null,
      base,
      detail: "",
      error: placeholderError(kind),
    };
  }

  const healthMs = Math.min(ms, 4000);
  const health = await readOk(n8nApiUrl(base, "/healthz"), healthMs);
  const ready = health.ok ? health : await readOk(n8nApiUrl(base, "/healthz/readiness"), healthMs);
  const reachedHealth = ready.ok && (ready.jsonStatus || looksLikeN8nPage(ready.text));

  if (opts.apiKey?.trim() && !opts.skipApi) {
    const listed = await listWorkflows(base, opts.apiKey, ms);
    if (listed.ok) {
      const count = listed.workflows.length;
      return {
        ok: true,
        reached: true,
        authorized: true,
        workflows: count,
        base,
        detail: `Connected to n8n${count ? ` · ${count} workflow${count === 1 ? "" : "s"}` : ""}.`,
      };
    }
    if (listed.status === 401 || listed.status === 403) {
      return {
        ok: true,
        reached: true,
        authorized: false,
        base,
        detail: `Reached ${base}, but the API key was rejected. In n8n open Settings → n8n API and create a key.`,
      };
    }
    if (reachedHealth) {
      return {
        ok: true,
        reached: true,
        authorized: false,
        base,
        detail: `n8n is running at ${base}. The API key could not list workflows.`,
        error: listed.error,
      };
    }
    return {
      ok: false,
      reached: false,
      authorized: null,
      base,
      detail: "",
      error: listed.error || unreachableError(kind, base),
    };
  }

  if (reachedHealth) {
    return {
      ok: true,
      reached: true,
      authorized: null,
      base,
      detail:
        kind === "local"
          ? `n8n is running at ${base}. Add an API key if you want this app to add workflows for you.`
          : `n8n is running at ${base}. Paste an API key so this app can add workflows for you.`,
    };
  }

  const page = await readOk(base, healthMs);
  if (page.ok && looksLikeN8nPage(page.text)) {
    return {
      ok: true,
      reached: true,
      authorized: null,
      base,
      detail: `Reached n8n at ${base}. Add an API key if you want this app to add workflows for you.`,
    };
  }

  return {
    ok: false,
    reached: false,
    authorized: null,
    base,
    detail: "",
    error: unreachableError(kind, base),
  };
}

export async function scanLocalN8n(preferred?: string): Promise<N8nProbe> {
  const bases: string[] = [];
  const add = (raw: string) => {
    try {
      const next = normalizeN8nBase(raw, "local");
      if (!bases.includes(next)) bases.push(next);
    } catch {
      /* skip */
    }
  };
  if (preferred?.trim() && !looksLikePlaceholder(preferred)) add(preferred);
  for (const candidate of LOCAL_N8N_CANDIDATES) add(candidate);

  const results = await Promise.all(
    bases.map((base) =>
      probeN8n({ baseUrl: base, kind: "local", timeoutMs: 1800, skipApi: true }),
    ),
  );
  const hit = results.find((item) => item.reached);
  if (hit) return hit;
  return {
    ok: false,
    reached: false,
    authorized: null,
    base: bases[0] ?? "http://127.0.0.1:5678",
    detail: "",
    error: "No n8n answered on this computer. Start it, then press Find n8n.",
  };
}

async function readOk(
  url: string,
  ms = 4000,
): Promise<{ ok: boolean; text: string; jsonStatus: boolean }> {
  try {
    const res = await fetchN8n(url, { headers: { Accept: "application/json, text/html" } }, ms);
    const text = await res.text().catch(() => "");
    let jsonStatus = false;
    try {
      const json = JSON.parse(text) as { status?: string };
      jsonStatus = typeof json.status === "string" && json.status.toLowerCase() === "ok";
    } catch {
      jsonStatus = false;
    }
    return { ok: res.ok, text, jsonStatus };
  } catch {
    return { ok: false, text: "", jsonStatus: false };
  }
}

export type N8nListed = { id: string; name: string; active: boolean };

export async function listWorkflows(
  base: string,
  apiKey: string,
  ms = TIMEOUT_MS,
): Promise<{ ok: boolean; workflows: N8nListed[]; status?: number; error?: string }> {
  try {
    const res = await fetchN8n(
      n8nApiUrl(base, "/api/v1/workflows?limit=50"),
      { headers: headers(apiKey) },
      ms,
    );
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        workflows: [],
        status: res.status,
        error: text.trim().slice(0, 400) || `n8n returned ${res.status}`,
      };
    }
    const json = JSON.parse(text || "{}") as {
      data?: { id?: string; name?: string; active?: boolean }[];
    };
    const workflows = (json.data ?? []).map((w) => ({
      id: String(w.id ?? ""),
      name: w.name ?? "Untitled",
      active: Boolean(w.active),
    }));
    return { ok: true, workflows, status: res.status };
  } catch (err) {
    return {
      ok: false,
      workflows: [],
      error: err instanceof Error ? err.message : "Could not list workflows",
    };
  }
}

export async function createStarterWorkflow(opts: {
  kind: "ask" | "receive";
  baseUrl: string;
  apiKey: string;
  origin: string;
  secret: string;
  model: string;
  appApiKey?: string;
  n8nKind?: N8nKind;
}): Promise<{
  ok: boolean;
  id?: string;
  name?: string;
  webhookUrl?: string;
  active?: boolean;
  reused?: boolean;
  error?: string;
  hint?: string;
}> {
  let base: string;
  try {
    base = normalizeN8nBase(opts.baseUrl, opts.n8nKind ?? "local");
    sanitizeN8nBase(base);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Bad n8n address" };
  }
  if (!opts.apiKey.trim()) {
    return { ok: false, error: "Paste an n8n API key first so this app can add the workflow." };
  }

  const file: N8nWorkflowFile =
    opts.kind === "ask"
      ? askModelWorkflow({
          origin: opts.origin,
          secret: opts.secret,
          model: opts.model,
          apiKey: opts.appApiKey,
        })
      : receiveChatWorkflow();

  const existing = await listWorkflows(base, opts.apiKey);
  if (existing.ok) {
    const found = existing.workflows.find((w) => w.name === file.name);
    if (found?.id) {
      const webhookUrl =
        opts.kind === "receive" ? await webhookFor(base, opts.apiKey, found.id) : undefined;
      if (!found.active) await activateWorkflow(base, opts.apiKey, found.id);
      return {
        ok: true,
        id: found.id,
        name: found.name,
        webhookUrl,
        active: true,
        reused: true,
        hint:
          opts.kind === "ask"
            ? "That workflow is already in n8n. Open it and press Test workflow."
            : "That workflow is already in n8n. Finished chats will use its webhook.",
      };
    }
  }

  try {
    const res = await fetchN8n(n8nApiUrl(base, "/api/v1/workflows"), {
      method: "POST",
      headers: { ...headers(opts.apiKey), "Content-Type": "application/json" },
      body: JSON.stringify(file),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        error: text.trim().slice(0, 400) || `n8n returned ${res.status}`,
      };
    }
    const json = JSON.parse(text || "{}") as { id?: string; name?: string; active?: boolean };
    const id = String(json.id ?? "");
    let active = Boolean(json.active);
    if (id && !active) {
      const turned = await activateWorkflow(base, opts.apiKey, id);
      active = turned;
    }
    const webhookUrl = opts.kind === "receive" ? n8nWebhookUrl(base, RECEIVE_WEBHOOK_PATH) : undefined;
    return {
      ok: true,
      id,
      name: json.name || file.name,
      webhookUrl,
      active,
      hint: active
        ? opts.kind === "ask"
          ? "Open the workflow in n8n and press Test workflow. The reply field is the model’s answer."
          : "The webhook is on. Turn on “Send each finished reply” here."
        : "Added in n8n. Turn the workflow on with the toggle at the top right.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not add the workflow in n8n",
    };
  }
}

async function activateWorkflow(base: string, apiKey: string, id: string): Promise<boolean> {
  try {
    const res = await fetchN8n(n8nApiUrl(base, `/api/v1/workflows/${encodeURIComponent(id)}/activate`), {
      method: "POST",
      headers: headers(apiKey),
    });
    if (res.ok) return true;
  } catch {
    /* try PUT below */
  }
  try {
    const current = await fetchN8n(n8nApiUrl(base, `/api/v1/workflows/${encodeURIComponent(id)}`), {
      headers: headers(apiKey),
    });
    if (!current.ok) return false;
    const json = (await current.json()) as Record<string, unknown>;
    const res = await fetchN8n(n8nApiUrl(base, `/api/v1/workflows/${encodeURIComponent(id)}`), {
      method: "PUT",
      headers: { ...headers(apiKey), "Content-Type": "application/json" },
      body: JSON.stringify({ ...json, active: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function webhookFor(base: string, apiKey: string, id: string): Promise<string> {
  try {
    const res = await fetchN8n(n8nApiUrl(base, `/api/v1/workflows/${encodeURIComponent(id)}`), {
      headers: headers(apiKey),
    });
    if (res.ok) {
      const json = (await res.json()) as { nodes?: { type?: string; parameters?: { path?: unknown } }[] };
      const path = webhookPathFromNodes(json.nodes ?? []) || RECEIVE_WEBHOOK_PATH;
      return n8nWebhookUrl(base, path);
    }
  } catch {
    /* fall through */
  }
  return n8nWebhookUrl(base, RECEIVE_WEBHOOK_PATH);
}
