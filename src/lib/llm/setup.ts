import type { LibraryModel } from "@/lib/llm/library";

export type SetupStatus = {
  os: "windows" | "mac" | "linux";
  osLabel: string;
  installed: boolean;
  running: boolean;
  version?: string;
  binary?: string | null;
  host: string;
};

export async function fetchSetup(host: string): Promise<SetupStatus> {
  const res = await fetch(`/api/setup?host=${encodeURIComponent(host)}`);
  if (!res.ok) {
    return {
      os: "linux",
      osLabel: "this computer",
      installed: false,
      running: false,
      host,
    };
  }
  return (await res.json()) as SetupStatus;
}

export async function searchLibrary(
  query: string,
): Promise<{ models: LibraryModel[]; suggestions: string[] }> {
  const res = await fetch(`/api/library?q=${encodeURIComponent(query)}`);
  if (!res.ok) return { models: [], suggestions: [] };
  const body = (await res.json()) as { models?: LibraryModel[]; suggestions?: string[] };
  return { models: body.models ?? [], suggestions: body.suggestions ?? [] };
}

export async function listHfQuants(repo: string): Promise<string[]> {
  const res = await fetch(`/api/library?files=${encodeURIComponent(repo)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { quants?: string[] };
  return body.quants ?? [];
}

export async function readSetupStream(
  url: string,
  onLine: (line: string) => void,
  init?: RequestInit,
): Promise<boolean> {
  const res = await fetch(url, init);
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ok = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      try {
        const json = JSON.parse(trimmed.slice(5).trim()) as {
          line?: string;
          status?: string;
          error?: string;
          done?: boolean;
          ok?: boolean;
          completed?: number;
          total?: number;
        };
        if (json.line) onLine(json.line);
        else if (json.status) {
          if (json.total && json.completed != null) {
            const pct = Math.min(100, Math.round((json.completed / json.total) * 100));
            onLine(`${json.status} ${pct}%`);
          } else onLine(json.status);
        }
        if (json.error) onLine(json.error);
        if (json.done) ok = Boolean(json.ok) && !json.error;
      } catch {
        /* skip */
      }
    }
  }
  return ok;
}

export function pullProgress(event: { completed?: number; total?: number }) {
  if (!event.total || event.completed == null) return null;
  return Math.min(100, Math.round((event.completed / event.total) * 100));
}
