import type { ModelRef } from "@/lib/chat/types";

export type ReviewPair = {
  writer: string;
  tester: string;
  ram: string;
};

export const PAIR_LANES = [
  { id: "veryLight", label: "Very light" },
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
] as const;

export type PairLaneId = (typeof PAIR_LANES)[number]["id"];

export type PairTask = {
  id: string;
  task: string;
  blurb: string;
  veryLight: ReviewPair;
  light: ReviewPair;
  medium: ReviewPair;
  heavy: ReviewPair;
};

export function pairLanes(task: PairTask): { id: PairLaneId; label: string; pair: ReviewPair }[] {
  return PAIR_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    pair: task[lane.id],
  }));
}

/**
 * Local writer + tester pairs. The tester should match the job — a general
 * chat model is a weak code reviewer. Writer and tester are always different.
 * Four sizes: very light (phones), light, medium, heavy.
 */
export const PAIR_TASKS: PairTask[] = [
  {
    id: "coding",
    task: "Coding",
    blurb: "Both sides should be coder models. A general chat model gives a weak review of code.",
    veryLight: {
      writer: "qwen2.5-coder:0.5b",
      tester: "deepseek-coder:1.3b",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "qwen2.5-coder:1.5b",
      tester: "codegemma:2b",
      ram: "Fits a small computer",
    },
    medium: {
      writer: "qwen2.5-coder:7b",
      tester: "starcoder2:7b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "qwen2.5-coder:14b",
      tester: "deepseek-coder-v2:16b",
      ram: "16 GB+ RAM or a GPU",
    },
  },
  {
    id: "writing",
    task: "Writing",
    blurb: "One drafts, the other edits for clarity, structure, and tone.",
    veryLight: {
      writer: "smollm2:360m",
      tester: "gemma2:2b",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "gemma2:2b",
      tester: "llama3.2:3b",
      ram: "Laptop-friendly",
    },
    medium: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:3b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "llama3.1:8b",
      ram: "8–16 GB RAM",
    },
  },
  {
    id: "math",
    task: "Math",
    blurb: "Writer solves; tester re-checks the steps. Phi and Qwen are strong for their size.",
    veryLight: {
      writer: "qwen2.5:0.5b",
      tester: "phi3:mini",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "qwen2.5:1.5b",
      tester: "phi3:mini",
      ram: "Small RAM",
    },
    medium: {
      writer: "qwen2.5:3b",
      tester: "llama3.2:3b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "deepseek-r1:7b",
      ram: "8–16 GB RAM",
    },
  },
  {
    id: "science",
    task: "Science",
    blurb: "Chemistry, physics, biology. Tester should catch units, mechanisms, and over-confident claims.",
    veryLight: {
      writer: "qwen2.5:0.5b",
      tester: "llama3.2:1b",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "qwen2.5:1.5b",
      tester: "llama3.2:3b",
      ram: "Laptop-friendly",
    },
    medium: {
      writer: "qwen2.5:3b",
      tester: "llama3.2:3b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "qwen2.5:14b",
      tester: "llama3.1:8b",
      ram: "16 GB+ RAM",
    },
  },
  {
    id: "translate",
    task: "Translation",
    blurb: "One translates, the other reads the result as a native check.",
    veryLight: {
      writer: "qwen2.5:0.5b",
      tester: "gemma2:2b",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "qwen2.5:1.5b",
      tester: "gemma2:2b",
      ram: "Small RAM",
    },
    medium: {
      writer: "qwen2.5:3b",
      tester: "llama3.2:3b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "llama3.1:8b",
      ram: "8–16 GB RAM",
    },
  },
  {
    id: "research",
    task: "Research",
    blurb: "Longer notes and documents. Tester looks for missing sources and holes.",
    veryLight: {
      writer: "llama3.2:1b",
      tester: "smollm2:360m",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:1.5b",
      ram: "Laptop-friendly",
    },
    medium: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:3b",
      ram: "8 GB RAM",
    },
    heavy: {
      writer: "gemma2:9b",
      tester: "qwen2.5:14b",
      ram: "16 GB+ RAM",
    },
  },
  {
    id: "chat",
    task: "Everyday chat",
    blurb: "General questions. Still use two different models so the tester is not marking its own homework.",
    veryLight: {
      writer: "smollm2:135m",
      tester: "smollm2:360m",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "smollm2:360m",
      tester: "llama3.2:1b",
      ram: "Tiny computers",
    },
    medium: {
      writer: "llama3.2:1b",
      tester: "llama3.2:3b",
      ram: "Laptop-friendly",
    },
    heavy: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:7b",
      ram: "8 GB RAM",
    },
  },
  {
    id: "images",
    task: "Images",
    blurb: "Writer reads the picture. Tester is a text model that checks the description.",
    veryLight: {
      writer: "moondream",
      tester: "smollm2:360m",
      ram: "Phones and tiny RAM",
    },
    light: {
      writer: "moondream",
      tester: "llama3.2:1b",
      ram: "Small RAM",
    },
    medium: {
      writer: "llava",
      tester: "llama3.2:3b",
      ram: "8 GB RAM, vision writer",
    },
    heavy: {
      writer: "llama3.2-vision",
      tester: "qwen2.5:7b",
      ram: "8–16 GB RAM, vision writer",
    },
  },
];

export function findLocalModel(models: ModelRef[], pullId: string): ModelRef | undefined {
  const ollama = models.filter((m) => m.provider === "ollama");
  const norm = (id: string) => (id.endsWith(":latest") ? id.slice(0, -7) : id);
  return (
    ollama.find((m) => m.id === pullId) ||
    ollama.find((m) => m.id === pullId || norm(m.id) === norm(pullId))
  );
}

export function pairStatus(models: ModelRef[], pair: ReviewPair) {
  const writer = findLocalModel(models, pair.writer);
  const tester = findLocalModel(models, pair.tester);
  return {
    writer,
    tester,
    ready: Boolean(writer && tester),
  };
}

/** Which side of a pair is still missing, or null if both or neither are installed. */
export function missingPairInstall(
  pair: ReviewPair,
  haveWriter: boolean,
  haveTester: boolean,
): string | null {
  if (haveWriter === haveTester) return null;
  return haveWriter ? pair.tester : pair.writer;
}
