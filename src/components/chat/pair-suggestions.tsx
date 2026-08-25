import { useState } from "react";
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
  const [openId, setOpenId] = useState<string | null>(variant === "bar" ? null : "coding");
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
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Review pairs
      </h2>
      <p className="mb-3 text-sm text-muted-foreground text-pretty">
        One model writes, a different model tests. Match the tester to the job — a general
        chat model is a poor code reviewer.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((task) => (
          <Button
            key={task.id}
            size="sm"
            variant={openId === task.id ? "secondary" : "outline"}
            className="h-8"
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
}: {
  task: PairTask;
  models: ModelRef[];
  canInstall: boolean;
  onInstallPair?: (writerId: string, testerId: string) => void;
  onBrowse?: () => void;
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
          />
        ))}
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
}: {
  label: string;
  pair: ReviewPair;
  models: ModelRef[];
  canInstall: boolean;
  taskName: string;
  onInstallPair?: (writerId: string, testerId: string) => void;
  onBrowse?: () => void;
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
            onClick={() => applyReadyPair(status.writer!, status.tester!, taskName)}
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
  const open = PAIR_TASKS.find((t) => t.id === openId);
  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Pairs</span>
        {PAIR_TASKS.map((task) => (
          <Button
            key={task.id}
            size="sm"
            variant={openId === task.id ? "secondary" : "ghost"}
            className={cn("h-7 px-2 text-xs", openId === task.id && "bg-secondary")}
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
        />
      ) : null}
    </div>
  );
}
