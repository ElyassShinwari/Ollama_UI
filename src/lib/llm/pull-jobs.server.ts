/** In-process pull jobs. Closing a browser window must not abort Ollama. */

export type PullEvent = {
  status?: string;
  total?: number;
  completed?: number;
  percent?: number;
  error?: string;
  done?: boolean;
  ok?: boolean;
};

export type ServerPullJob = {
  id: string;
  percent: number;
  status: "running" | "done" | "failed" | "cancelled";
  error?: string;
  completed?: number;
  total?: number;
};

type Internal = ServerPullJob & {
  abort: AbortController;
  listeners: Set<(event: PullEvent) => void>;
};

const jobs = new Map<string, Internal>();
const KEEP_MS = 120_000;

function norm(id: string) {
  return id.endsWith(":latest") ? id.slice(0, -7) : id;
}

function matchJob(id: string) {
  return jobs.get(id) ?? [...jobs.values()].find((job) => norm(job.id) === norm(id));
}

function publicSnap(job: Internal): ServerPullJob {
  return {
    id: job.id,
    percent: job.percent,
    status: job.status,
    error: job.error,
    completed: job.completed,
    total: job.total,
  };
}

function snapshotEvent(job: Internal): PullEvent {
  if (job.status === "done") {
    return { done: true, ok: true, status: "success", percent: 100, completed: job.completed, total: job.total };
  }
  if (job.status === "failed" || job.status === "cancelled") {
    return { done: true, ok: false, error: job.error || job.status, percent: job.percent };
  }
  return {
    status: "downloading",
    completed: job.completed,
    total: job.total,
    percent: job.percent,
  };
}

function emit(job: Internal, event: PullEvent) {
  for (const fn of job.listeners) fn(event);
}

function settle(job: Internal, status: ServerPullJob["status"], event: PullEvent) {
  job.status = status;
  if (status === "done") job.percent = 100;
  emit(job, event);
  setTimeout(() => {
    if (jobs.get(job.id) === job && job.status !== "running") jobs.delete(job.id);
  }, KEEP_MS);
}

export function listServerPulls(): ServerPullJob[] {
  return [...jobs.values()].map(publicSnap);
}

export function cancelServerPull(id: string): boolean {
  const job = matchJob(id);
  if (!job || job.status !== "running") return false;
  job.abort.abort();
  return true;
}

export function subscribeServerPull(id: string, fn: (event: PullEvent) => void): () => void {
  const job = matchJob(id);
  if (!job) return () => {};
  job.listeners.add(fn);
  fn(snapshotEvent(job));
  return () => {
    job.listeners.delete(fn);
  };
}

export function startServerPull(host: string, id: string): ServerPullJob {
  const existing = matchJob(id);
  if (existing?.status === "running") return publicSnap(existing);
  const abort = new AbortController();
  const job: Internal = {
    id,
    percent: 1,
    status: "running",
    abort,
    listeners: new Set(),
  };
  jobs.set(id, job);
  void runPull(host, job);
  return publicSnap(job);
}

function percentOf(total?: number, completed?: number) {
  if (!total || completed == null) return null;
  return Math.min(100, Math.round((completed / total) * 100));
}

async function runPull(host: string, job: Internal) {
  try {
    const res = await fetch(`${host.replace(/\/$/, "")}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: job.id, model: job.id, stream: true }),
      signal: job.abort.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      job.error = text || `Pull failed (${res.status})`;
      settle(job, "failed", { error: job.error, done: true });
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const onLine = (line: string) => {
      if (!line.trim()) return false;
      try {
        const json = JSON.parse(line) as {
          status?: string;
          total?: number;
          completed?: number;
          error?: string;
        };
        if (json.error) {
          job.error = json.error;
          settle(job, "failed", { error: json.error, done: true });
          return true;
        }
        if (typeof json.total === "number") job.total = json.total;
        if (typeof json.completed === "number") job.completed = json.completed;
        const pct = percentOf(json.total ?? job.total, json.completed ?? job.completed);
        if (pct != null) job.percent = Math.max(job.percent, pct);
        if (json.status === "success") job.percent = 100;
        emit(job, {
          status: json.status,
          total: json.total ?? job.total,
          completed: json.completed ?? job.completed,
          percent: job.percent,
        });
      } catch {
        /* skip */
      }
      return false;
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (onLine(line)) return;
      }
    }
    if (buf.trim() && onLine(buf)) return;
    settle(job, "done", { done: true, ok: true, status: "success", percent: 100 });
  } catch (err) {
    if (job.abort.signal.aborted) {
      job.error = "cancelled";
      settle(job, "cancelled", { error: "cancelled", done: true });
      return;
    }
    job.error = err instanceof Error ? err.message : "Pull failed";
    settle(job, "failed", { error: job.error, done: true });
  }
}
