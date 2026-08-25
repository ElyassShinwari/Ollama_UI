import type { ModelRef } from "@/lib/chat/types";

export type ReviewPair = {
  writer: string;
  tester: string;
  ram: string;
};

export type PairTask = {
  id: string;
  task: string;
  blurb: string;
  light: ReviewPair;
  heavy: ReviewPair;
};

/**
 * Local writer + tester pairs. The tester should match the job — a general
 * chat model is a weak code reviewer. Writer and tester are always different.
 */
export const PAIR_TASKS: PairTask[] = [
  {
    id: "coding",
    task: "Coding",
    blurb: "Both sides should be coder models. A general chat model gives a weak review of code.",
    light: {
      writer: "qwen2.5-coder:1.5b",
      tester: "codegemma:2b",
      ram: "Fits a small computer",
    },
    heavy: {
      writer: "qwen2.5-coder:7b",
      tester: "deepseek-coder-v2:16b",
      ram: "16 GB+ RAM or a GPU",
    },
  },
  {
    id: "writing",
    task: "Writing",
    blurb: "One drafts, the other edits for clarity, structure, and tone.",
    light: {
      writer: "gemma2:2b",
      tester: "llama3.2:3b",
      ram: "Laptop-friendly",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "llama3.1:8b",
      ram: "8 GB+ RAM",
    },
  },
  {
    id: "math",
    task: "Math",
    blurb: "Writer solves; tester re-checks the steps. Phi and Qwen are strong for their size.",
    light: {
      writer: "qwen2.5:1.5b",
      tester: "phi3:mini",
      ram: "Small RAM",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "deepseek-r1:7b",
      ram: "8 GB+ RAM",
    },
  },
  {
    id: "science",
    task: "Science",
    blurb: "Chemistry, physics, biology. Tester should catch units, mechanisms, and over-confident claims.",
    light: {
      writer: "qwen2.5:3b",
      tester: "llama3.2:3b",
      ram: "Laptop-friendly",
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
    light: {
      writer: "qwen2.5:1.5b",
      tester: "gemma2:2b",
      ram: "Small RAM",
    },
    heavy: {
      writer: "qwen2.5:7b",
      tester: "llama3.1:8b",
      ram: "8 GB+ RAM",
    },
  },
  {
    id: "research",
    task: "Research",
    blurb: "Longer notes and documents. Tester looks for missing sources and holes.",
    light: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:3b",
      ram: "Laptop-friendly",
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
    light: {
      writer: "smollm2:360m",
      tester: "llama3.2:1b",
      ram: "Tiny computers",
    },
    heavy: {
      writer: "llama3.2:3b",
      tester: "qwen2.5:7b",
      ram: "8 GB+ RAM",
    },
  },
  {
    id: "images",
    task: "Images",
    blurb: "Writer reads the picture. Tester is a text model that checks the description.",
    light: {
      writer: "moondream",
      tester: "llama3.2:1b",
      ram: "Small RAM",
    },
    heavy: {
      writer: "llama3.2-vision",
      tester: "qwen2.5:7b",
      ram: "8 GB+ RAM, vision writer",
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
    ready: Boolean(writer && tester && writer.id !== tester.id),
  };
}
