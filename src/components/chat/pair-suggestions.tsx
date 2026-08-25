import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PAIR_TASKS, pairLanes, pairStatus, type PairTask, type ReviewPair } from "@/lib/llm/pairs";
import { useChatStore } from "@/lib/chat/store";
import type { ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

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
  canInstall = false,
  onInstallPair,
  onBrowse,
}: {
  models: ModelRef[];
  variant?: "cards" | "bar";
  query?: string;
  canInstall?: boolean;
  onInstallPair?: (writerId: string, testerId: string) => void;
  onBrowse?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = () => setOpenId(null);
  const rootRef = useDismiss(Boolean(openId), close);
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
        Review pairs
      </h2>
      <p className="mb-3 text-sm text-muted-foreground text-pretty">
        One model writes, a different model tests — or the same model reviews its own work.
        Match the tester to the job when you use two models.
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
            canInstall={canInstall}
            onInstallPair={onInstallPair}
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
  canInstall,
  onInstallPair,
  onBrowse,
  onUsed,
}: {
  task: PairTask;
  models: ModelRef[];
  canInstall: boolean;
  onInstallPair?: (writerId: string, testerId: string) => void;
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
            canInstall={canInstall}
            taskName={task.task}
            onInstallPair={onInstallPair}
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

function PairLane({
  label,
  pair,
  models,
  canInstall,
  taskName,
  onInstallPair,
  onBrowse,
  onUsed,
}: {
  label: string;
  pair: ReviewPair;
  models: ModelRef[];
  canInstall: boolean;
  taskName: string;
  onInstallPair?: (writerId: string, testerId: string) => void;
  onBrowse?: () => void;
  onUsed?: () => void;
}) {
  const status = pairStatus(models, pair);
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
        {status.ready && status.writer && status.tester ? (
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
        ) : canInstall && onInstallPair ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onInstallPair(pair.writer, pair.tester)}
          >
            Install both
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8" onClick={() => onBrowse?.()}>
            Install in Models
          </Button>
        )}
      </div>
    </div>
  );
}

export function PairBar({
  models,
  onBrowse,
}: {
  models: ModelRef[];
  onBrowse?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = () => setOpenId(null);
  const rootRef = useDismiss(Boolean(openId), close);
  const open = PAIR_TASKS.find((t) => t.id === openId);
  return (
    <div ref={rootRef} className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Pairs</span>
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
          canInstall={false}
          onBrowse={onBrowse}
          onUsed={close}
        />
      ) : null}
    </div>
  );
}
