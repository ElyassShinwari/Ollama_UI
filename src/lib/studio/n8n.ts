export type N8nKind = "local" | "cloud";

export type N8nChatEvent = {
  event: "assistant" | "ping";
  user?: string;
  assistant?: string;
  model?: string;
  conversationId?: string;
};

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  webhookId?: string;
};

export type N8nWorkflowFile = {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
  settings: { executionOrder: "v1" };
};

export const ASK_WORKFLOW_NAME = "Ollama UI — ask your model";
export const RECEIVE_WORKFLOW_NAME = "Ollama UI — receive chats";
export const RECEIVE_WEBHOOK_PATH = "ollama-ui-chat";

const LOCAL_BASE = "http://127.0.0.1:5678";
const UI_PATH = /^\/(home|workflow|workflows|signin|setup|settings|projects|executions)(\/|$)/i;

export function defaultN8nBase(kind: N8nKind): string {
  return kind === "local" ? LOCAL_BASE : "https://your-instance.app.n8n.cloud";
}

export function sanitizeN8nBase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("n8n address is empty");
  const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("n8n address must be http or https");
  }
  const cleaned = url.pathname.replace(/\/+$/, "");
  const path = !cleaned || cleaned === "/" || UI_PATH.test(cleaned) ? "" : cleaned;
  return `${url.origin}${path}`;
}

export function normalizeN8nBase(raw: string, kind: N8nKind = "local"): string {
  const trimmed = raw.trim();
  if (!trimmed) return defaultN8nBase(kind);
  if (kind === "cloud" && /^[a-z0-9-]+$/i.test(trimmed)) {
    return `https://${trimmed}.app.n8n.cloud`;
  }
  return sanitizeN8nBase(trimmed);
}

export function looksLikePlaceholder(base: string): boolean {
  return /your-instance|your-name|example\.com/i.test(base);
}

export function sanitizeWebhookUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Webhook URL is empty");
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Webhook must be http or https");
  }
  return url.toString();
}

export function n8nApiUrl(base: string, path: string): string {
  const root = sanitizeN8nBase(base);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${root}${suffix}`;
}

export function n8nWebhookUrl(base: string, path: string, test = false): string {
  const slug = path.replace(/^\/+/, "");
  return n8nApiUrl(base, `${test ? "/webhook-test/" : "/webhook/"}${slug}`);
}

export function extractN8nMessage(body: unknown): string {
  if (typeof body === "string") return body.trim();
  if (!body || typeof body !== "object") return "";
  const rec = body as Record<string, unknown>;
  const direct = firstString(rec, ["message", "text", "chatInput", "prompt", "query", "input"]);
  if (direct) return direct;
  if (rec.body && typeof rec.body === "object") {
    const nested = extractN8nMessage(rec.body);
    if (nested) return nested;
  }
  if (Array.isArray(rec.messages)) {
    const last = rec.messages[rec.messages.length - 1] as { content?: unknown } | undefined;
    if (typeof last?.content === "string") return last.content.trim();
  }
  return "";
}

function firstString(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function extractN8nModel(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const rec = body as Record<string, unknown>;
  if (typeof rec.model === "string" && rec.model.trim()) return rec.model.trim();
  if (rec.body && typeof rec.body === "object") {
    const inner = (rec.body as { model?: unknown }).model;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return fallback;
}

export function n8nHttpExample(origin: string, secret: string, model: string): string {
  return `POST ${origin}/api/n8n
Headers
  Content-Type: application/json
  x-n8n-secret: ${secret || "YOUR_SECRET"}
Body
{
  "message": "Summarize this note",
  "model": "${model || "llama3.2"}"
}`;
}

const CLIP = 20_000;

export function n8nOutboundBody(event: N8nChatEvent): Record<string, unknown> {
  return {
    source: "ollama-ui",
    event: event.event,
    user: clip(event.user ?? ""),
    assistant: clip(event.assistant ?? ""),
    model: event.model ?? "",
    conversationId: event.conversationId ?? "",
    at: new Date().toISOString(),
  };
}

function clip(value: string): string {
  if (value.length <= CLIP) return value;
  return `${value.slice(0, CLIP)}\n…`;
}

function nid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function connect(from: string, to: string) {
  return {
    [from]: { main: [[{ node: to, type: "main", index: 0 }]] },
  };
}

export function askModelWorkflow(opts: {
  origin: string;
  secret: string;
  model: string;
}): N8nWorkflowFile {
  const origin = opts.origin.replace(/\/+$/, "");
  const model = opts.model || "llama3.2";
  const trigger: N8nNode = {
    id: nid(),
    name: "When clicking Test workflow",
    type: "n8n-nodes-base.manualTrigger",
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
  };
  const sample: N8nNode = {
    id: nid(),
    name: "Sample question",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [240, 0],
    parameters: {
      assignments: {
        assignments: [
          { id: nid(), name: "message", value: "Say hello in one short sentence.", type: "string" },
          { id: nid(), name: "model", value: model, type: "string" },
        ],
      },
      options: {},
    },
  };
  const request: N8nNode = {
    id: nid(),
    name: "Ask Ollama UI",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [480, 0],
    parameters: {
      method: "POST",
      url: `${origin}/api/n8n`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "x-n8n-secret", value: opts.secret || "YOUR_SECRET" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ message: $json.message, model: $json.model }) }}",
      options: {},
    },
  };
  return {
    name: ASK_WORKFLOW_NAME,
    nodes: [trigger, sample, request],
    connections: {
      ...connect(trigger.name, sample.name),
      ...connect(sample.name, request.name),
    },
    settings: { executionOrder: "v1" },
  };
}

export function receiveChatWorkflow(): N8nWorkflowFile {
  const webhook: N8nNode = {
    id: nid(),
    name: "Chat from Ollama UI",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    webhookId: nid(),
    parameters: {
      httpMethod: "POST",
      path: RECEIVE_WEBHOOK_PATH,
      responseMode: "lastNode",
      options: {},
    },
  };
  const keep: N8nNode = {
    id: nid(),
    name: "Keep the chat",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [280, 0],
    parameters: {
      assignments: {
        assignments: [
          { id: nid(), name: "user", value: "={{ $json.user }}", type: "string" },
          { id: nid(), name: "assistant", value: "={{ $json.assistant }}", type: "string" },
          { id: nid(), name: "model", value: "={{ $json.model }}", type: "string" },
        ],
      },
      options: {},
    },
  };
  const note: N8nNode = {
    id: nid(),
    name: "Next step",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [280, 180],
    parameters: {
      content:
        "Finished replies from Ollama UI land here. Add Slack, email, a sheet, or a database after Keep the chat.",
      height: 160,
      width: 280,
    },
  };
  return {
    name: RECEIVE_WORKFLOW_NAME,
    nodes: [webhook, keep, note],
    connections: connect(webhook.name, keep.name),
    settings: { executionOrder: "v1" },
  };
}

export function webhookPathFromNodes(nodes: { type?: string; parameters?: { path?: unknown } }[]): string {
  const node = nodes.find((item) => item.type === "n8n-nodes-base.webhook");
  return typeof node?.parameters?.path === "string" ? node.parameters.path.replace(/^\/+/, "") : "";
}

export function looksLikeN8nPage(text: string): boolean {
  return /n8n/i.test(text);
}
