import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { mcpRoot } from "@/lib/studio/config.server";
import type { McpServerConfig } from "@/lib/studio/types";

type Rpc = { jsonrpc: "2.0"; id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };

function sendStdio(proc: ReturnType<typeof spawn>, msg: Rpc) {
  proc.stdin?.write(`${JSON.stringify(msg)}\n`);
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
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);
  const listed = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    signal: AbortSignal.timeout(6000),
  });
  const body = (await listed.json()) as Rpc;
  const tools = (body.result as { tools?: { name: string; description?: string }[] } | undefined)?.tools;
  return tools ?? [];
}

async function listStdioTools(server: McpServerConfig) {
  if (!server.command) throw new Error("Command is required for stdio MCP");
  const args = (server.args ?? "").split(" ").filter(Boolean);
  const proc = spawn(server.command, args, { windowsHide: true });
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
  const res = await fetch(server.url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(20000),
  });
  return await res.json();
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
