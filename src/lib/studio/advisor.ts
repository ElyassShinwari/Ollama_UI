import type { ModelRef } from "@/lib/chat/types";

export type TaskAdvice = {
  id: string;
  task: string;
  blurb: string;
  pull: string[];
  needs: string;
  canTrain: boolean;
  trainNote: string;
};

export const TASK_ADVICE: TaskAdvice[] = [
  {
    id: "weak-pc",
    task: "Small computer / first try",
    blurb: "Tiny models that run with little RAM.",
    pull: ["smollm2:135m", "smollm2:360m"],
    needs: "CPU is enough",
    canTrain: true,
    trainNote: "You can fine-tune SmolLM2 outside Ollama (Unsloth / LLaMA-Factory), then import a GGUF. Ollama itself cannot train.",
  },
  {
    id: "chat",
    task: "Everyday chat",
    blurb: "Balanced replies for questions and writing.",
    pull: ["llama3.2:3b", "qwen2.5:3b", "gemma2:2b"],
    needs: "4 GB+ RAM",
    canTrain: true,
    trainNote: "Fine-tune with exported JSONL. In this app, use Instructions + Knowledge (RAG) instead of training.",
  },
  {
    id: "code",
    task: "Coding",
    blurb: "Better at functions, diffs, and explanations.",
    pull: ["qwen2.5-coder:1.5b", "qwen2.5-coder:7b", "deepseek-coder-v2:16b"],
    needs: "Coder models; 7b wants a GPU or lots of RAM",
    canTrain: true,
    trainNote: "Possible with extra tools. For day-to-day work, pull a coder model and add repo files as knowledge.",
  },
  {
    id: "vision",
    task: "Images",
    blurb: "Read pictures you attach in chat.",
    pull: ["moondream", "llava", "llama3.2-vision"],
    needs: "A vision-capable model",
    canTrain: false,
    trainNote: "Ollama cannot train vision adapters here. Use a vision model as-is.",
  },
  {
    id: "tools",
    task: "MCP / tools / APIs",
    blurb: "Models that can call tools. Needed for MCP servers.",
    pull: ["qwen2.5:7b", "llama3.1:8b", "llama3.2:3b"],
    needs: "Model with a tools capability",
    canTrain: false,
    trainNote: "Tool use is not learned by chatting. Pick a model that already supports tools.",
  },
  {
    id: "chatbot",
    task: "Website or WhatsApp bot",
    blurb: "Must follow instructions and stay in character.",
    pull: ["qwen2.5:7b", "llama3.1:8b", "llama3.2:3b"],
    needs: "A stronger instruct model. Tiny models will drift.",
    canTrain: true,
    trainNote: "Do not expect tiny models to be a public bot. Use Instructions + Knowledge. Fine-tune only if you export data.",
  },
  {
    id: "long",
    task: "Long documents",
    blurb: "Larger context windows.",
    pull: ["gemma2:9b", "qwen2.5:7b", "llama3.1:8b"],
    needs: "Check the context meter in chat",
    canTrain: false,
    trainNote: "Long context is not the same as training. Put files in Knowledge.",
  },
];

export function modelSupportsTools(model: ModelRef | null | undefined) {
  const caps = model?.capabilities ?? [];
  if (caps.includes("tools")) return true;
  const id = (model?.id ?? "").toLowerCase();
  return /qwen2|llama3\.1|llama3\.2|mistral|command-r|gpt-oss/.test(id);
}

export function modelCanFineTune(model: ModelRef | null | undefined) {
  if (!model) return false;
  const id = model.id.toLowerCase();
  if (/llava|vision|moondream|embed|whisper/.test(id)) return false;
  return /llama|qwen|phi|gemma|mistral|smollm|deepseek/.test(id);
}

export function adviceForModel(model: ModelRef | null | undefined): string {
  if (!model) return "Pick a local model first. smollm2:135m is the lightest test.";
  const id = model.id.toLowerCase();
  if (/smollm/.test(id)) {
    return "Good on weak PCs. Weak as a public chatbot. You can export chats and fine-tune SmolLM2 outside Ollama.";
  }
  if (/coder|code/.test(id)) return "Use this for programming. Add a GitHub repo as knowledge for your codebase.";
  if (/llava|vision|moondream/.test(id)) return "This model can read images. It cannot be fine-tuned in Ollama.";
  if (modelSupportsTools(model)) return "This model can use MCP tools if you connect a server.";
  return "Use Instructions for style, Knowledge for your data. Ollama will not train this model in place.";
}
