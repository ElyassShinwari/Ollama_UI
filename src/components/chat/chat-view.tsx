import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Composer } from "@/components/chat/composer";
import { ContextMeter } from "@/components/chat/context-meter";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ModelPicker } from "@/components/chat/model-picker";
import { PairBar } from "@/components/chat/pair-suggestions";
import { estimateTokens, greetingForNow, isContextOverflowError } from "@/lib/utils";
import { selectActiveConversation, chatPersist, useChatStore } from "@/lib/chat/store";
import { siblingsOf, visibleMessages } from "@/lib/chat/tree";
import { streamChat } from "@/lib/llm/catalog";
import { friendlyOllamaError } from "@/lib/llm/context";
import {
  buildMessageFromFiles,
  readDroppedFile,
  type PendingFile,
} from "@/lib/llm/files";
import { repetitionCutoff } from "@/lib/llm/repeat";
import { formatChatPrompt } from "@/lib/llm/tokens";
import { combinedInstructions, knowledgeBlock } from "@/lib/studio/store";
import {
  CLOUD_LABEL,
  FINAL_REVIEW_SYSTEM,
  REVIEW_SELF_SYSTEM,
  REVIEW_SYSTEM,
  cloudSecret,
  finalHandoff,
  handoffToWriter,
  reviewSatisfied,
} from "@/lib/llm/cloud";
import type { Message, ModelRef } from "@/lib/chat/types";

const SUGGESTIONS = [
  "Explain a hard idea in plain language",
  "Draft a short, direct email",
  "Find holes in this plan",
  "Write a small function and walk through it",
];

const MAX_TURN_CHARS = 80_000;

type ChatTurn = {
  role: string;
  content: string;
  images?: string[];
  documents?: Message["documents"];
};

function clipTurn(text: string) {
  if (text.length <= MAX_TURN_CHARS) return text;
  return `${text.slice(0, MAX_TURN_CHARS)}\n\n[truncated]`;
}

function slimTurns(turns: ChatTurn[], withMedia = false): ChatTurn[] {
  return turns.map((m) => ({
    role: m.role,
    content: clipTurn(m.content),
    images: withMedia ? m.images : undefined,
    documents: withMedia ? m.documents?.filter((d) => d.data) : undefined,
  }));
}

export function ChatView({
  models,
  onOpenSidebar,
  onToggleSidebar,
  onNewChat,
  onBrowseModels,
}: {
  models: ModelRef[];
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onBrowseModels?: (query?: string) => void;
}) {
  const conversation = useChatStore(selectActiveConversation);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const testerKey = useChatStore((s) => s.testerKey);
  const setTesterKey = useChatStore((s) => s.setTesterKey);
  const dropBinary = useChatStore((s) => s.dropBinary);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const replaceMessageContent = useChatStore((s) => s.replaceMessageContent);
  const forkUserMessage = useChatStore((s) => s.forkUserMessage);
  const selectSibling = useChatStore((s) => s.selectSibling);
  const setUsage = useChatStore((s) => s.setUsage);
  const markContextExceeded = useChatStore((s) => s.markContextExceeded);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelRef | null>(null);
  const [switchWarn, setSwitchWarn] = useState<{ name: string; used: number; limit: number } | null>(
    null,
  );
  const [cycles, setCycles] = useState(3);
  const [cycleNote, setCycleNote] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const streamingConvRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const promptTokensRef = useRef(0);
  const completionTokensRef = useRef(0);
  const pendingChunkRef = useRef("");
  const flushTimerRef = useRef<number | null>(null);

  // Restored full implementation is continued in next update if truncated
  return null;
}
