import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { reposRoot } from "@/lib/studio/config.server";
import { parseRepoUrl } from "@/lib/studio/github";

export { parseRepoUrl };

function run(cmd: string, args: string[], cwd?: string) {
  return new Promise<{ code: number; out: string }>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("git timed out"));
    }, 120_000);
    child.stdout?.on("data", (b) => (out += b.toString()));
    child.stderr?.on("data", (b) => (out += b.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out });
    });
  });
}

function redactGit(text: string) {
  return text
    .replace(/x-access-token:[^@\s]+@/gi, "x-access-token:***@")
    .replace(/ghp_[A-Za-z0-9]+/g, "ghp_***")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "github_pat_***");
}

function authedUrl(url: string, token?: string) {
  if (!token) return url;
  if (url.startsWith("https://")) {
    return url.replace("https://", `https://x-access-token:${encodeURIComponent(token)}@`);
  }
  return url;
}

async function isGitRepo(dest: string) {
  try {
    const st = await stat(join(dest, ".git"));
    return st.isDirectory() || st.isFile();
  } catch {
    return false;
  }
}

export async function cloneRepo(input: string, token?: string) {
  const parsed = parseRepoUrl(input);
  const root = reposRoot();
  await mkdir(root, { recursive: true });
  const dest = join(root, parsed.slug);
  try {
    const st = await stat(dest);
    if (st.isDirectory()) {
      if (await isGitRepo(dest)) {
        const pull = await pullRepo(dest, token);
        return { ...parsed, path: dest, log: pull.out, existed: true };
      }
      await rm(dest, { recursive: true, force: true });
    }
  } catch {
    /* new */
  }
  const url = authedUrl(`https://github.com/${parsed.owner}/${parsed.repo}.git`, token);
  const result = await run("git", ["clone", "--depth", "1", url, dest]);
  if (result.code !== 0) {
    await rm(dest, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(redactGit(result.out) || "git clone failed");
  }
  return { ...parsed, path: dest, log: result.out, existed: false };
}

export async function pullRepo(path: string, token?: string) {
  if (token) {
    const remote = await run("git", ["remote", "get-url", "origin"], path);
    if (remote.code === 0) {
      const raw = remote.out.trim().split(/\r?\n/).pop() ?? "";
      const cleaned = raw.replace(/https:\/\/[^@]+@/i, "https://");
      if (cleaned.startsWith("https://")) {
        await run("git", ["remote", "set-url", "origin", authedUrl(cleaned, token)], path);
      }
    }
  }
  const result = await run("git", ["pull", "--ff-only"], path);
  if (result.code !== 0) throw new Error(redactGit(result.out) || "git pull failed");
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
