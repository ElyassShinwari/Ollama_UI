import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { reposRoot } from "@/lib/studio/config.server";

function run(cmd: string, args: string[], cwd?: string) {
  return new Promise<{ code: number; out: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true });
    let out = "";
    child.stdout?.on("data", (b) => (out += b.toString()));
    child.stderr?.on("data", (b) => (out += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

export function parseRepoUrl(raw: string) {
  const trimmed = raw.trim().replace(/\.git$/, "");
  const https = trimmed.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
  if (https) return { owner: https[1]!, repo: https[2]!, slug: `${https[1]}-${https[2]}` };
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split("/");
    return { owner: owner!, repo: repo!, slug: `${owner}-${repo}` };
  }
  throw new Error("Use owner/repo or a GitHub URL");
}

function authedUrl(url: string, token?: string) {
  if (!token) return url;
  if (url.startsWith("https://")) {
    return url.replace("https://", `https://x-access-token:${encodeURIComponent(token)}@`);
  }
  return url;
}

export async function cloneRepo(input: string, token?: string) {
  const parsed = parseRepoUrl(input);
  const root = reposRoot();
  await mkdir(root, { recursive: true });
  const dest = join(root, parsed.slug);
  try {
    const st = await stat(dest);
    if (st.isDirectory()) {
      const pull = await pullRepo(dest);
      return { ...parsed, path: dest, log: pull.out, existed: true };
    }
  } catch {
    /* new */
  }
  const url = authedUrl(`https://github.com/${parsed.owner}/${parsed.repo}.git`, token);
  const result = await run("git", ["clone", "--depth", "1", url, dest]);
  if (result.code !== 0) throw new Error(result.out || "git clone failed");
  return { ...parsed, path: dest, log: result.out, existed: false };
}

export async function pullRepo(path: string) {
  const result = await run("git", ["pull", "--ff-only"], path);
  if (result.code !== 0) throw new Error(result.out || "git pull failed");
  return result;
}

export async function listCloned() {
  const root = reposRoot();
  try {
    const names = await readdir(root);
    const out = [];
    for (const name of names) {
      const path = join(root, name);
      const st = await stat(path);
      if (st.isDirectory()) out.push({ name, path, updatedAt: st.mtimeMs });
    }
    return out;
  } catch {
    return [];
  }
}
