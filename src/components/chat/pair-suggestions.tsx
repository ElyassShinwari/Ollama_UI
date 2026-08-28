import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAIR_TASKS, findLocalModel, pairLanes, pairStatus, type PairTask, type ReviewPair } from "@/lib/llm/pairs";
import { pullOllamaModel } from "@/lib/llm/pull-client";
import { useChatStore } from "@/lib/chat/store";
import type { ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

function applyReadyPair(writer: ModelRef, tester: ModelRef, task: string) {
  useChatStore.getState().setSelectedModel(writer);
  useChatStore.getState().setTesterKey(`${tester.provider}:${tester.id}`);
  toast.success(`${task}: ${writer.name} writes, ${tester.name} tests`);
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
        {tasks.map((task) => (
          <Button
            key={task.id}
            size="sm"
            variant={openId === task.id ? "secondary" : "outline"}
            className="h-8"
            aria-expanded={openId === task.id}
            onClick={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
          >
            {task.task}
          </Button>
        ))}
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
  return (
    <div className="rounded-lg border border-border px-3 py-2 sm:col-span-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Same model
        <span className="ml-2 font-normal normal-case">Writes, then reviews its own work</span>
      </p>
      <p className="mt-1 font-mono text-xs leading-5">
        {selected ? `${selected.name} writes and tests` : "Pick a chat model first"}
      </p>
      <div className="mt-2">
        <Button
          size="sm"
          className="h-8"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            useChatStore.getState().setTesterKey(`${selected.provider}:${selected.id}`);
            toast.success(`${taskName}: ${selected.name} writes and tests`);
            onUsed?.();
          }}
        >
          Use same model
        </Button>
      </div>
    </div>
  );
}

function PullBar({ label, pct }: { label: string; pct: number }) {
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="space-y-1">
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
  const [pct, setPct] = useState<{ w: number; t: number } | null>(null);
  const installing = pct != null;

  async function installBoth() {
    const host = useChatStore.getState().settings.ollamaHost;
    const haveW = Boolean(findLocalModel(models, pair.writer));
    const haveT = Boolean(findLocalModel(models, pair.tester));
    setPct({ w: haveW ? 100 : 1, t: haveT ? 100 : 1 });
    toast.message(`Installing ${pair.writer} and ${pair.tester}…`);
    try {
      if (!haveW) {
        await pullOllamaModel(host, pair.writer, (p) => setPct((cur) => ({ w: p, t: cur?.t ?? 1 })));
      }
      if (!haveT && pair.tester !== pair.writer) {
        await pullOllamaModel(host, pair.tester, (p) => setPct((cur) => ({ w: cur?.w ?? 100, t: p })));
      }
      const fresh = (await onRefreshLocal?.()) ?? models;
      const writer = findLocalModel(fresh, pair.writer);
      const tester = findLocalModel(fresh, pair.tester);
      if (writer && tester) {
        applyReadyPair(writer, tester, taskName);
        onUsed?.();
      } else {
        toast.error("Download did not finish. Open Models if you need to retry.");
        onBrowse?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not install this pair");
      onBrowse?.();
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        <span className="ml-2 font-normal normal-case">{pair.ram}</span>
      </p>
      <p className="mt-1 font-mono text-xs leading-5">
        Writer {pair.writer}
        <br />
        Tester {pair.tester}
      </p>
      <div className="mt-2">
        {installing ? (
          <div className="space-y-2">
            <PullBar label={pair.writer} pct={pct.w} />
            <PullBar label={pair.tester} pct={pct.t} />
          </div>
        ) : status.ready && status.writer && status.tester ? (
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              applyReadyPair(status.writer!, status.tester!, taskName);
              onUsed?.();
            }}
          >
            Use this pair
          </Button>
        ) : (
          <Button size="sm" className="h-8" onClick={() => void installBoth()}>
            Install both
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
}: {
  models: ModelRef[];
  onBrowse?: () => void;
  onRefreshLocal?: () => Promise<ModelRef[] | void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = () => setOpenId(null);
  const rootRef = useDismiss(Boolean(openId), close);
  const locale = useChatStore((s) => s.settings.locale);
  const open = PAIR_TASKS.find((t) => t.id === openId);
  return (
    <div ref={rootRef} className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t(locale, "reviewPairs")}</span>
        {PAIR_TASKS.map((task) => (
          <Button
            key={task.id}
            size="sm"
            variant={openId === task.id ? "secondary" : "ghost"}
            className={cn("h-7 px-2 text-xs", openId === task.id && "bg-secondary")}
            aria-expanded={openId === task.id}
            onClick={() => setOpenId((cur) => (cur === task.id ? null : task.id))}
          >
            {task.task}
          </Button>
        ))}
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
