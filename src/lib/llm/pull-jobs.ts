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
    promise: Promise.resolve(false),
  };
  job.promise = pullOllamaModel(
    host,
    id,
    (p) => {
      job.percent = Math.max(job.percent, p);
      emit();
    },
    abort.signal,
  )
    .then((ok) => {
      if (abort.signal.aborted) {
        job.status = "cancelled";
        emit();
        return false;
      }
      job.status = ok ? "done" : "failed";
      if (ok) job.percent = 100;
      emit();
      return ok;
    })
    .catch((err) => {
      if (isAbortError(err) || abort.signal.aborted) {
        job.status = "cancelled";
        emit();
        return false;
      }
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "failed";
      emit();
      return false;
    });
  jobs.set(id, job);
  emit();
  return job;
}

export function cancelPull(id: string) {
  matchJob(id)?.abort.abort();
}

export async function installPairModels(
  host: string,
  writer: string,
  tester: string,
  have: { writer: boolean; tester: boolean },
): Promise<{ writerOk: boolean; testerOk: boolean }> {
  let writerOk = have.writer;
  let testerOk = have.tester;
  if (!have.writer) writerOk = await startPull(host, writer).promise;
  if (!have.tester && tester !== writer) testerOk = await startPull(host, tester).promise;
  else if (tester === writer) testerOk = writerOk;
  return { writerOk, testerOk };
}

export function __resetPullsForTests() {
  for (const job of jobs.values()) job.abort.abort();
  jobs.clear();
  version = 0;
}
