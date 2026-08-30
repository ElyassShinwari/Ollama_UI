import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAIR_TASKS, findLocalModel, missingPairInstall, pairLanes, pairStatus, type PairTask, type ReviewPair } from "@/lib/llm/pairs";
import { isAbortError } from "@/lib/llm/setup";
import { adoptModel } from "@/lib/llm/catalog";
import { cancelPull, installPairModels, runningPulls, snapshotPull, usePullVersion } from "@/lib/llm/pull-jobs";
import { useChatStore } from "@/lib/chat/store";
import type { ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

function applyReadyPair(writer: ModelRef, tester: ModelRef, task: string) {
  const locale = useChatStore.getState().settings.locale;
  adoptModel(writer);
  useChatStore.getState().setTesterKey(`${tester.provider}:${tester.id}`);
  toast.success(
    t(locale, "pairReady", { task, writer: writer.name, tester: tester.name }),
  );
}

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (ref.current && node && !ref.current.contains(node)) onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

export function PairSuggestions({
  models,
  variant = "cards",
  query = "",
  onRefreshLocal,
  onBrowse,
}: {
  models: ModelRef[];
  variant?: "cards" | "bar";
  query?: string;
  onRefreshLocal?: () => Promise<ModelRef[] | void>;
  onBrowse?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = () => setOpenId(null);
  const rootRef = useDismiss(Boolean(openId), close);
  const locale = useChatStore((s) => s.settings.locale);
  const q = query.trim().toLowerCase();
  const tasks = q
    ? PAIR_TASKS.filter((t) => {
        if (t.task.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q)) return true;
        return pairLanes(t).some(
          (lane) => lane.pair.writer.includes(q) || lane.pair.tester.includes(q),
        );
      })
    : PAIR_TASKS;
  if (tasks.length === 0) return null;

  return (
    <section ref={rootRef}>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t(locale, "reviewPairs")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground text-pretty">
        {t(locale, "reviewPairsBlurb")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((task) => {
          const busy = pairLanes(task).some(
            (lane) =>
              snapshotPull(lane.pair.writer)?.status === "running" ||
              snapshotPull(lane.pair.tester)?.status === "running",
          );
          return (
          <Button
            key={task.id}
            size="sm"
            variant={openId === task.id ? "secondary" : "outline"}
            className="h-8"
            aria-expanded={openId === task.id}
            onClick={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
          >
            {task.task}
            {busy ? "…" : ""}
          </Button>
          );
        })}
      </div>
      {tasks.map((task) =>
        openId === task.id ? (
          <PairTaskBody
            key={task.id}
            task={task}
            models={models}
            onRefreshLocal={onRefreshLocal}
            onBrowse={onBrowse}
            onUsed={close}
          />
        ) : null,
      )}
    </section>
  );
}

function PairTaskBody({
  task,
  models,
  onRefreshLocal,
  onBrowse,
  onUsed,
}: {
  task: PairTask;
  models: ModelRef[];
  onRefreshLocal?: () => Promise<ModelRef[] | void>;
  onBrowse?: () => void;
  onUsed?: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground text-pretty">{task.blurb}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {pairLanes(task).map((lane) => (
          <PairLane
            key={lane.id}
            label={lane.label}
            pair={lane.pair}
            models={models}
            taskName={task.task}
            onRefreshLocal={onRefreshLocal}
            onBrowse={onBrowse}
            onUsed={onUsed}
          />
        ))}
        <SameModelLane taskName={task.task} onUsed={onUsed} />
      </div>
    </div>
  );
}

function SameModelLane({ taskName, onUsed }: { taskName: string; onUsed?: () => void }) {
  const selected = useChatStore((s) => s.selectedModel);
  const locale = useChatStore((s) => s.settings.locale);
  return (
    <div className="rounded-lg border border-border px-3 py-2 sm:col-span-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t(locale, "sameModel")}
        <span className="ml-2 font-normal normal-case">{t(locale, "sameModelBlurb")}</span>
      </p>
      <p className="mt-1 font-mono text-xs leading-5">
        {selected ? t(locale, "writesAndTests", { name: selected.name }) : t(locale, "chooseChatModelFirst")}
      </p>
      <div className="mt-2">
        <Button
          size="sm"
          className="h-8"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            useChatStore.getState().setTesterKey(`${selected.provider}:${selected.id}`);
            toast.success(t(locale, "pairSameReady", { task: taskName, name: selected.name }));
            onUsed?.();
          }}
        >
          {t(locale, "useSameModel")}
        </Button>
      </div>
    </div>
  );
}

export function PullBar({
  label,
  pct,
  onCancel,
}: {
  label: string;
  pct: number;
  onCancel?: () => void;
}) {
  const locale = useChatStore((s) => s.settings.locale);
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  const canStop = Boolean(onCancel) && n < 100;
  return (
    <div className="relative space-y-1 pe-7 pt-1">
      {canStop ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="absolute top-0 end-0 z-10 size-6 rounded-full border border-border bg-card text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
          aria-label={t(locale, "cancelNamed", { label })}
          onClick={onCancel}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
      <p className="font-mono text-[11px] text-muted-foreground">
        {label} · {n}%
      </p>
      <span className="block h-1 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${n}%` }} />
      </span>
    </div>
  );
}

function PairLane({
  label,
  pair,
  models,
  taskName,
  onRefreshLocal,
  onBrowse,
  onUsed,
}: {
  label: string;
  pair: ReviewPair;
  models: ModelRef[];
  taskName: string;
  onRefreshLocal?: () => Promise<ModelRef[] | void>;
  onBrowse?: () => void;
  onUsed?: () => void;
}) {
  const status = pairStatus(models, pair);
  const locale = useChatStore((s) => s.settings.locale);
  usePullVersion();
  const wJob = snapshotPull(pair.writer);
  const tJob = snapshotPull(pair.tester);
  const haveW = Boolean(status.writer);
  const haveT = Boolean(status.tester);
  const missing = missingPairInstall(pair, haveW, haveT);
  const wPct = haveW ? 100 : wJob?.percent ?? 0;
  const tPct = haveT ? 100 : tJob?.percent ?? 0;
  const installing =
    wJob?.status === "running" ||
    tJob?.status === "running" ||
    wJob?.status === "done" ||
    tJob?.status === "done";
  const stillPulling = wJob?.status === "running" || tJob?.status === "running";

  useEffect(() => {
    if (wJob?.status !== "done" && tJob?.status !== "done") return;
    void onRefreshLocal?.();
  }, [wJob?.status, tJob?.status, onRefreshLocal]);

  async function installBoth() {
    const host = useChatStore.getState().settings.ollamaHost;
    toast.message(
      missing
        ? t(locale, "pairInstallingOne", { id: missing })
        : t(locale, "pairInstalling", { writer: pair.writer, tester: pair.tester }),
    );
    try {
      const result = await installPairModels(host, pair.writer, pair.tester, {
        writer: haveW,
        tester: haveT,
      });
      const fresh = (await onRefreshLocal?.()) ?? models;
      const writer = findLocalModel(fresh, pair.writer);
      const tester = findLocalModel(fresh, pair.tester);
      if (writer && tester) {
        toast.success(t(locale, "pairReadyBg", { task: taskName, writer: writer.name, tester: tester.name }));
        return;
      }
      if (result.writerOk || result.testerOk) toast.message(t(locale, "pairOneReady"));
      else if (!result.writerOk && !result.testerOk) toast.message(t(locale, "pairCancelled"));
    } catch (err) {
      if (!isAbortError(err)) {
        toast.error(err instanceof Error ? err.message : t(locale, "pairInstallFailed"));
        onBrowse?.();
      }
    }
  }

  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        <span className="ml-2 font-normal normal-case">{pair.ram}</span>
      </p>
      <p className="mt-1 font-mono text-xs leading-5">
        {t(locale, "writer")} {pair.writer}
        <br />
        {t(locale, "tester")} {pair.tester}
      </p>
      <div className="mt-2">
        {stillPulling || (installing && !status.ready && (wJob || tJob)) ? (
          <div className="space-y-2">
            {!haveW && wJob ? (
              <PullBar
                label={pair.writer}
                pct={wPct}
                onCancel={wJob.status === "running" ? () => cancelPull(pair.writer) : undefined}
              />
            ) : null}
            {!haveT && tJob ? (
              <PullBar
                label={pair.tester}
                pct={tPct}
                onCancel={tJob.status === "running" ? () => cancelPull(pair.tester) : undefined}
              />
            ) : null}
          </div>
        ) : status.ready && status.writer && status.tester ? (
          <Button
            size="sm"
            className="min-h-11 md:h-8"
            onClick={() => {
              applyReadyPair(status.writer!, status.tester!, taskName);
              onUsed?.();
            }}
          >
            {t(locale, "useThisPair")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="min-h-11 max-w-full whitespace-normal text-start md:h-8"
            onClick={() => void installBoth()}
          >
            {missing ? t(locale, "installNamed", { id: missing }) : t(locale, "installBoth")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function PairBar({
  models,
  onBrowse,
  onRefreshLocal,
  className,
}: {
  models: ModelRef[];
  onBrowse?: () => void;
  onRefreshLocal?: () => Promise<ModelRef[] | void>;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = () => setOpenId(null);
  const rootRef = useDismiss(Boolean(openId), close);
  const locale = useChatStore((s) => s.settings.locale);
  usePullVersion();
  const open = PAIR_TASKS.find((t) => t.id === openId);
  return (
    <div ref={rootRef} className={cn("hidden border-b border-border px-3 py-2 md:block", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t(locale, "reviewPairs")}</span>
        {PAIR_TASKS.map((task) => {
          const busy = pairLanes(task).some(
            (lane) =>
              snapshotPull(lane.pair.writer)?.status === "running" ||
              snapshotPull(lane.pair.tester)?.status === "running",
          );
          return (
            <Button
              key={task.id}
              size="sm"
              variant={openId === task.id ? "secondary" : "ghost"}
              className={cn("min-h-11 px-2.5 text-xs md:h-7 md:min-h-0 md:px-2", openId === task.id && "bg-secondary")}
              aria-expanded={openId === task.id}
              onClick={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
            >
              {task.task}
              {busy ? "…" : ""}
            </Button>
          );
        })}
      </div>
      {open ? (
        <PairTaskBody
          task={open}
          models={models}
          onRefreshLocal={onRefreshLocal}
          onBrowse={onBrowse}
          onUsed={close}
        />
      ) : null}
    </div>
  );
}

/** Progress for installs that keep running after the pair window is closed. */
export function BackgroundPulls({ className }: { className?: string }) {
  usePullVersion();
  const locale = useChatStore((s) => s.settings.locale);
  const jobs = runningPulls();
  if (jobs.length === 0) return null;
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-3 pb-2 md:px-4", className)}>
      <p className="mb-1 text-[11px] text-muted-foreground">{t(locale, "pairKeepsRunning")}</p>
      <div className="space-y-1 rounded-xl border border-border bg-card px-3 py-2">
        {jobs.map((job) => (
          <PullBar key={job.id} label={job.id} pct={job.percent} onCancel={() => cancelPull(job.id)} />
        ))}
      </div>
    </div>
  );
}
