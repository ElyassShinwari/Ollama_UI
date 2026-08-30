import type { ModelRef } from "./types";

export function isPlaceholderModel(model: ModelRef | null | undefined): boolean {
  return !model || model.id === "pending";
}

export function pickStarterModel(models: ModelRef[]): ModelRef | null {
  const real = models.filter((m) => m.id !== "pending");
  return real.find((m) => m.provider === "ollama") ?? real[0] ?? null;
}
