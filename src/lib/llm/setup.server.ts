import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { sanitizeOllamaHost } from "@/lib/utils";

export type HostOs = "windows" | "mac" | "linux";

export function detectOs(): { id: HostOs; label: string; platform: NodeJS.Platform } {
  if (process.platform === "win32") return { id: "windows", label: "Windows", platform: "win32" };
  if (process.platform === "darwin") return { id: "mac", label: "macOS", platform: "darwin" };
  return { id: "linux", label: "Linux", platform: process.platform };
}

function extraBinDirs() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const local = process.env.LOCALAPPDATA || "";
  if (process.platform === "win32") {
    return [
      join(local, "Programs", "Ollama"),
      "C:\\Program Files\\Ollama",
    ];
  }
  return ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", join(home, ".local", "bin")];
}

export function ollamaPath(): string | null {
  const names = process.platform === "win32" ? ["ollama.exe", "ollama"] : ["ollama"];
  const dirs = [...(process.env.PATH ?? "").split(delimiter), ...extraBinDirs()];
  for (const dir of dirs) {
    for (const name of names) {
      const full = join(dir, name);
      if (dir && existsSync(full)) return full;
    }
  }
  return null;
}

export async function ollamaRunning(hostRaw: string): Promise<{ running: boolean; version?: string }> {
  try {
    const host = sanitizeOllamaHost(hostRaw);
    const res = await fetch(`${host}/api/version`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return { running: false };
    const body = (await res.json()) as { version?: string };
    return { running: true, version: body.version };
  } catch {
    return { running: false };
  }
}

export async function setupStatus(hostRaw: string) {
  const os = detectOs();
  const binary = ollamaPath();
  const live = await ollamaRunning(hostRaw);
  return {
    os: os.id,
    osLabel: os.label,
    installed: Boolean(binary) || live.running,
    running: live.running,
    version: live.version,
    binary,
    host: hostRaw,
  };
}

export function runCommand(
  command: string,
  args: string[],
  onLine: (line: string) => void,
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts?.cwd,
      env: { ...process.env, ...opts?.env },
      shell: process.platform === "win32",
      windowsHide: true,
    });
    const timer =
      opts?.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            child.kill();
            reject(new Error("Timed out"));
          }, opts.timeoutMs)
        : null;
    const feed = (buf: Buffer) => {
      const text = buf.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLine(line);
      }
    };
    child.stdout?.on("data", feed);
    child.stderr?.on("data", feed);
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

export async function installOllama(onLine: (line: string) => void): Promise<void> {
  const os = detectOs();
  onLine(`Detected ${os.label}. Installing Ollama…`);
  if (os.id === "linux") {
    const code = await runCommand(
      "sh",
      ["-c", "curl -fsSL https://ollama.com/install.sh | sh"],
      onLine,
      { timeoutMs: 8 * 60_000 },
    );
    if (code !== 0) throw new Error("Ollama install script failed. You may need to run it in a terminal.");
    return;
  }
  if (os.id === "mac") {
    const brew = await runCommand("sh", ["-c", "command -v brew"], () => undefined).catch(() => 1);
    if (brew === 0) {
      const code = await runCommand("brew", ["install", "ollama"], onLine, { timeoutMs: 8 * 60_000 });
      if (code !== 0) throw new Error("brew install ollama failed");
      return;
    }
    onLine("Homebrew not found. Download the Mac app from https://ollama.com/download");
    await runCommand("open", ["https://ollama.com/download"], onLine).catch(() => undefined);
    throw new Error("Open the Ollama download page, install the Mac app, then click Start Ollama.");
  }
  const code = await runCommand(
    "winget",
    [
      "install",
      "-e",
      "--id",
      "Ollama.Ollama",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ],
    onLine,
    { timeoutMs: 10 * 60_000 },
  );
  if (code !== 0) {
    onLine("winget failed. Download Ollama from https://ollama.com/download");
    throw new Error("Install Ollama from https://ollama.com/download then click Start Ollama.");
  }
}

export async function startOllama(onLine: (line: string) => void): Promise<void> {
  const os = detectOs();
  const bin = ollamaPath() ?? "ollama";
  onLine(`Starting Ollama on ${os.label}…`);
  if (os.id === "mac") {
    await runCommand("open", ["-a", "Ollama"], onLine).catch(() => undefined);
  }
  if (os.id === "windows") {
    const exe = ollamaPath();
    if (exe) spawn(exe, ["serve"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    else spawn("ollama", ["serve"], { detached: true, stdio: "ignore", shell: true, windowsHide: true }).unref();
  } else {
    spawn(bin, ["serve"], { detached: true, stdio: "ignore" }).unref();
  }
  for (let i = 0; i < 20; i++) {
    const live = await ollamaRunning("http://127.0.0.1:11434");
    if (live.running) {
      onLine(live.version ? `Ollama ${live.version} is running.` : "Ollama is running.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Ollama did not start. Open the Ollama app and try again.");
}
