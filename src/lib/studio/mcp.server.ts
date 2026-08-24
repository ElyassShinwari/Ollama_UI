import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { mcpRoot } from "@/lib/studio/config.server";
import type { McpServerConfig } from "@/lib/studio/types";

type Rpc = { jsonrpc: "2.0"; id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };

function sendStdio(proc: ReturnType<typeof spawn>, msg: Rpc) {
  proc.stdin?.write(`${JSON.stringify(msg)}\n`);
}

function splitArgs(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return [s.slice(1, -1)];
  }
  if (/[\\/]/.test(s) && !/\s-[A-Za-z]/.test(s)) return [s];
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out.filter(Boolean);
}

async function readRpc(res: Response): Promise<Rpc> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty MCP response");
  if (ct.includes("event-stream") || text.trimStart().startsWith("event:") || text.includes("\ndata:")) {
    const line = text
      .split(/\r?\n/)
      .reverse()
      .find((l) => l.startsWith("data:"));
    if (!line) throw new Error("Empty MCP stream");
    return JSON.parse(line.slice(5).trim()) as Rpc;
  }
  return JSON.parse(text) as Rpc;
}

export async function listMcpTools(server: McpServerConfig): Promise<{ name: string; description?: string }[]> {
  if (server.transport === "stdio") {
    return listStdioTools(server);
  }
  if (!server.url) return [];
  const url = server.url.replace(/\/+$/, "");
  const init = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ollama-ui", version: "1.0" },
      },
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!init.ok) throw new Error(`MCP HTTP ${init.status}`);
  const session = init.headers.get("mcp-session-id") || init.headers.get("Mcp-Session-Id") || "";
  const sessionHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(session ? { "Mcp-Session-Id": session } : {}),
  };
  await readRpc(init).catch(() => undefined);
  await fetch(url, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);
  const listed = await fetch(url, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    signal: AbortSignal.timeout(6000),
  });
  if (!listed.ok) throw new Error(`MCP HTTP ${listed.status}`);
  const body = await readRpc(listed);
  if (body.error) throw new Error(body.error.message || "MCP error");
  const tools = (body.result as { tools?: { name: string; description?: string }[] } | undefined)?.tools;
  return tools ?? [];
}

async function listStdioTools(server: McpServerConfig) {
  if (!server.command) throw new Error("Command is required for stdio MCP");
  const args = splitArgs(server.args ?? "");
  const proc = spawn(server.command, args, {
    windowsHide: true,
    shell: process.platform === "win32",
  });
  const lines: string[] = [];
  return await new Promise<{ name: string; description?: string }[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("MCP timed out"));
    }, 8000);
    proc.stdout?.on("data", (buf) => {
      lines.push(buf.toString());
      const joined = lines.join("");
      for (const line of joined.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as Rpc;
          if (msg.id === 2) {
            clearTimeout(timer);
            proc.kill();
            if (msg.error) {
              reject(new Error(msg.error.message || "MCP error"));
              return;
            }
            const tools = (msg.result as { tools?: { name: string; description?: string }[] })?.tools;
            resolve(tools ?? []);
          }
        } catch {
          /* wait */
        }
      }
    });
    proc.stderr?.on("data", () => undefined);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    sendStdio(proc, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ollama-ui", version: "1.0" },
      },
    });
    sendStdio(proc, { jsonrpc: "2.0", method: "notifications/initialized" });
    sendStdio(proc, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  });
}

export async function callMcpTool(server: McpServerConfig, name: string, args: Record<string, unknown>) {
  if (server.transport !== "http" && server.transport !== "sse") {
    throw new Error("Tool calls from chat currently use HTTP MCP servers");
  }
  if (!server.url) throw new Error("MCP URL missing");
  const url = server.url.replace(/\/+$/, "");
  const init = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ollama-ui", version: "1.0" },
      },
    }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  const session = init?.headers.get("mcp-session-id") || init?.headers.get("Mcp-Session-Id") || "";
  if (init) await readRpc(init).catch(() => undefined);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(20000),
  });
  return await readRpc(res);
}

export async function createMcpScaffold(name: string, description: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-mcp";
  const dir = join(mcpRoot(), slug);
  await mkdir(dir, { recursive: true });
  const serverJs = `#!/usr/bin/env node
process.stdin.setEncoding("utf8");
let buf = "";
const tools = [
  {
    name: "echo",
    description: ${JSON.stringify(description || "Echo text back")},
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
];
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\\n");
}
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === "initialize") {
      send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: ${JSON.stringify(slug)}, version: "0.1.0" } } });
    } else if (msg.method === "tools/list") {
      send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
    } else if (msg.method === "tools/call") {
      const text = String(msg.params?.arguments?.text ?? "");
      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text }] } });
    } else if (msg.id) {
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
    }
  }
});
`;
  const readme = `# ${slug}

Local MCP server scaffold from Ollama UI.

Run:

\`\`\`
node ${join(dir, "server.js")}
\`\`\`

In Ollama UI → Studio → MCP, add:

- Transport: stdio
- Command: node
- Args: ${join(dir, "server.js")}

Replace the echo tool with your own functions.
`;
  await writeFile(join(dir, "server.js"), serverJs);
  await writeFile(join(dir, "README.md"), readme);
  return { dir, command: "node", args: join(dir, "server.js") };
}
