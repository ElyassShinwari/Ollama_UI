export function parseRepoUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  const https = trimmed.match(/github\.com[:/]([^/]+)\/([^/#?]+)/i);
  if (https) {
    const repo = https[2]!.replace(/\.git$/i, "");
    if (repo && !/^(tree|blob|issues|pull|releases|actions|wiki|commit|commits)$/i.test(repo)) {
      return { owner: https[1]!, repo, slug: `${https[1]}-${repo}` };
    }
  }
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split("/");
    return { owner: owner!, repo: repo!, slug: `${owner}-${repo}` };
  }
  throw new Error("Use owner/repo or a GitHub URL");
}