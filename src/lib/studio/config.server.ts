import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultStudio, type StudioConfig } from "@/lib/studio/types";

const file = () => join(process.cwd(), "data", "studio.json");

export async function loadStudio(): Promise<StudioConfig> {
  try {
    const raw = await readFile(file(), "utf8");
    return { ...defaultStudio(), ...(JSON.parse(raw) as StudioConfig) };
  } catch {
    return defaultStudio();
  }
}

export async function saveStudio(patch: Partial<StudioConfig>): Promise<StudioConfig> {
  const current = await loadStudio();
  const next = { ...current, ...patch };
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(file(), JSON.stringify(next, null, 2));
  return next;
}

export function reposRoot() {
  return join(process.cwd(), "data", "repos");
}

export function mcpRoot() {
  return join(process.cwd(), "data", "mcp-servers");
}
