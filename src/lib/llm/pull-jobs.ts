import { useSyncExternalStore } from "react";
import { sameOllamaId } from "./library";
import { pullOllamaModel } from "./pull-client";
import { isAbortError } from "./setup";

export type PullStatus = "running" | "done" | "failed" | "cancelled";

export type PullJob = {
  id: string;
  percent: number;
  status: PullStatus;
  error?: string;
};

type Internal = PullJob & {
  abort: AbortController;
  promise: Promise<boolean>;
  userCancel: boolean;
};

const jobs = new Map<string, Internal>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const fn of listeners) fn();
}

export function subscribePulls(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPullVersion() {
  return version;
}

export function usePullVersion() {
  return useSyncExternalStore(subscribePulls, getPullVersion, getPullVersion);
}

function matchJob(id: string) {
  return jobs.get(id) ?? [...jobs.values()].find((job) => sameOllamaId(job.id, id));
}

export function snapshotPull(id: string): PullJob | undefined {
  const job = matchJob(id);
  if (!job) return undefined;
  return { id: job.id, percent: job.percent, status: job.status, error: job.error };
}

export function runningPulls(): PullJob[] {
  return [...jobs.values()]
    .filter((job) => job.status === "running")
    .map((job) => ({ id: job.id, percent: job.percent, status: job.status, error: job.error }));
}

export function pullPercents(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const job of jobs.values()) {
    if (job.status === "running" || job.status === "done") out[job.id] = job.percent;
  }
  return out;
}

type RemoteJob = { id: string; percent: number; status: PullStatus };

async function fetchRemotePulls(): Promise<RemoteJob[]> {
  try {
    const res = await fetch("/api/pull");
    if (!res.ok) return [];
    const body = (await res.json()) as { jobs?: RemoteJob[] };
    return Array.isArray(body.jobs) ? body.jobs : [];
  } catch {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function watchPull(host: string, job: Internal): Promise<boolean> {
  let delay = 400;
  while (!job.userCancel) {
    if (job.abort.signal.aborted && !job.userCancel) {
      job.abort = new AbortController();
    }
    try {
      const ok = await pullOllamaModel(
        host,
        job.id,
        (p) => {
          job.percent = Math.max(job.percent, p);
          emit();
        },
        job.abort.signal,
      );
      if (job.userCancel) break;
      if (ok) {
        job.status = "done";
        job.percent = 100;
        emit();
        return true;
      }
      const remote = (await fetchRemotePulls()).find((item) => sameOllamaId(item.id, job.id));
      if (remote?.status === "running") {
        job.percent = Math.max(job.percent, remote.percent);
        emit();
        await sleep(delay);
        delay = Math.min(3000, delay + 400);
        continue;
      }
      if (remote?.status === "done") {
        job.status = "done";
        job.percent = 100;
        emit();
        return true;
      }
      if (remote?.status === "cancelled") {
        job.status = "cancelled";
        emit();
        return false;
      }
      job.status = "failed";
      emit();
      return false;
    } catch (err) {
      if (job.userCancel) break;
      const remote = (await fetchRemotePulls()).find((item) => sameOllamaId(item.id, job.id));
      if (remote?.status === "done") {
        job.status = "done";
        job.percent = 100;
        emit();
        return true;
      }
      if (remote?.status === "cancelled") {
        job.status = "cancelled";
        emit();
        return false;
      }
      if (remote?.status === "running" || isAbortError(err) || job.abort.signal.aborted) {
        job.percent = Math.max(job.percent, remote?.percent ?? 0);
        emit();
        await sleep(delay);
        delay = Math.min(3000, delay + 400);
        continue;
      }
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "failed";
      emit();
      return false;
    }
  }
  job.status = "cancelled";
  emit();
  return false;
}

/** Reuse an in-flight pull. Closing a sheet does not cancel it. */
export function startPull(host: string, id: string): Internal {
  const existing = matchJob(id);
  if (existing?.status === "running") return existing;
  const abort = new AbortController();
  const job: Internal = {
    id,
    percent: 1,
    status: "running",
    abort,
    userCancel: false,
    promise: Promise.resolve(false),
  };
  jobs.set(id, job);
  emit();
  job.promise = watchPull(host, job);
  return job;
}

export function cancelPull(id: string) {
  const job = matchJob(id);
  if (job) {
    job.userCancel = true;
    job.abort.abort();
  }
  void fetch("/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: id, cancel: true }),
  }).catch(() => {});
}

/** Attach to pulls that kept running after a sheet was closed. */
export async function hydratePulls(host: string) {
  const remotes = await fetchRemotePulls();
  for (const remote of remotes) {
    if (remote.status !== "running") continue;
    const local = matchJob(remote.id);
    if (local?.status === "running") {
      local.percent = Math.max(local.percent, remote.percent);
      emit();
      continue;
    }
    const job = startPull(host, remote.id);
    job.percent = Math.max(job.percent, remote.percent);
    emit();
  }
}

export async function installPairModels(
  host: string,
  writer: string,
  tester: string,
  have: { writer: boolean; tester: boolean },
): Promise<{ writerOk: boolean; testerOk: boolean }> {
  const writerP = have.writer ? Promise.resolve(true) : startPull(host, writer).promise;
  const testerP = have.tester
    ? Promise.resolve(true)
    : tester === writer
      ? writerP
      : startPull(host, tester).promise;
  const [writerOk, testerOk] = await Promise.all([writerP, testerP]);
  return { writerOk, testerOk };
}

export function __resetPullsForTests() {
  for (const job of jobs.values()) {
    job.userCancel = true;
    job.abort.abort();
  }
  jobs.clear();
  version = 0;
}
