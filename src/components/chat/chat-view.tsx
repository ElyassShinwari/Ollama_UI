import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, PanelLeft, Trash2 } from "lucide-react";
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
import { countModelTokens, formatChatPrompt } from "@/lib/llm/tokens";
import { combinedInstructions, knowledgeBlock } from "@/lib/studio/store";
import {
  CLOUD_LABEL,
  FINAL_REVIEW_SYSTEM,
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
  const deleteConversation = useChatStore((s) => s.deleteConversation);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const allMessages = conversation?.messages ?? [];
  const messages = conversation
    ? visibleMessages(conversation.messages, conversation.activeRootId)
    : [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const contextLimit = selectedModel?.contextLength ?? conversation?.model.contextLength;
  const contextUsed = conversation?.contextTokens ?? 0;
  const contextFull =
    Boolean(conversation?.contextExceeded) ||
    (contextLimit != null && contextUsed >= contextLimit);

  const visibleKey = messages.map((m) => m.id).join(">");

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.toString() && scrollerRef.current?.contains(sel.anchorNode)) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingId]);

  useEffect(() => {
    if (!conversation || streamingId) return;
    const model = useChatStore.getState().selectedModel;
    if (!model) return;
    const visible = visibleMessages(conversation.messages, conversation.activeRootId);
    if (visible.length === 0) {
      useChatStore.getState().resetUsage(conversation.id);
      return;
    }
    const last = visible[visible.length - 1];
    const promptMsgs =
      last?.role === "assistant" ? visible.slice(0, -1) : visible;
    const completionText = last?.role === "assistant" ? last.content : "";
    let cancelled = false;
    void (async () => {
      const prompt = formatChatPrompt(
        [useChatStore.getState().settings.systemPrompt, combinedInstructions(), knowledgeBlock()]
          .filter(Boolean)
          .join("\n\n"),
        promptMsgs.map((m) => ({ role: m.role, content: m.content })),
      );
      if (model.provider !== "ollama") {
        if (cancelled) return;
        setUsage(conversation.id, {
          promptTokens: estimateTokens(prompt),
          completionTokens: estimateTokens(completionText),
        });
        return;
      }
      const [promptTokens, completionTokens] = await Promise.all([
        countModelTokens({
          host: useChatStore.getState().settings.ollamaHost,
          model: model.id,
          text: prompt,
          transport: model.transport,
        }),
        completionText
          ? countModelTokens({
              host: useChatStore.getState().settings.ollamaHost,
              model: model.id,
              text: completionText,
              transport: model.transport,
            })
          : Promise.resolve(0),
      ]);
      if (cancelled) return;
      promptTokensRef.current = promptTokens;
      completionTokensRef.current = completionTokens;
      setUsage(conversation.id, { promptTokens, completionTokens });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, visibleKey, streamingId, setUsage]);

  const greeting = useMemo(() => greetingForNow(), []);

  useEffect(() => {
    if (!selectedModel) return;
    const others = models.filter(
      (m) => !(m.id === selectedModel.id && m.provider === selectedModel.provider),
    );
    const ok = others.some((m) => `${m.provider}:${m.id}` === testerKey);
    if (ok) return;
    const pick = others[0];
    setTesterKey(pick ? `${pick.provider}:${pick.id}` : null);
  }, [selectedModel, models, testerKey, setTesterKey]);

  function publishUsage(conversationId: string, promptTokens: number, completionTokens: number) {
    promptTokensRef.current = promptTokens;
    completionTokensRef.current = completionTokens;
    setUsage(conversationId, { promptTokens, completionTokens });
  }

  function flushPending(conversationId: string, assistantId: string) {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const chunk = pendingChunkRef.current;
    if (!chunk) return;
    pendingChunkRef.current = "";
    appendToMessage(conversationId, assistantId, chunk);
    const current = useChatStore
      .getState()
      .conversations.find((c) => c.id === conversationId)
      ?.messages.find((m) => m.id === assistantId)?.content;
    if (!current) return;
    const cut = repetitionCutoff(current);
    if (cut != null) {
      pendingChunkRef.current = "";
      replaceMessageContent(conversationId, assistantId, current.slice(0, cut).trimEnd());
      abortRef.current?.abort();
    }
  }

  async function runCompletion(
    conversationId: string,
    history: ChatTurn[],
    parentId: string,
    using?: ModelRef,
    extraSystem?: string,
  ): Promise<string> {
    const model = using ?? useChatStore.getState().selectedModel;
    if (!model) {
      toast.error("Choose a model first");
      return "";
    }
    const settingsNow = useChatStore.getState().settings;
    const apiKey = cloudSecret(settingsNow, model.provider) || undefined;
    const accountId =
      model.provider === "openai" ? settingsNow.openaiOAuth?.accountId : undefined;
    const systemPrompt = [settingsNow.systemPrompt, combinedInstructions(), knowledgeBlock(), extraSystem]
      .filter(Boolean)
      .join("\n\n");
    const payload = slimTurns(
      history,
      history.some((m) => Boolean(m.images?.length || m.documents?.some((d) => d.data))),
    );
    const promptText = formatChatPrompt(systemPrompt, payload);
    const promptEstimate = estimateTokens(promptText);
    const limit = model.contextLength;
    if (limit && promptEstimate >= limit) {
      markContextExceeded(conversationId);
    }
    publishUsage(conversationId, promptEstimate, 0);

    chatPersist.enabled = false;
    streamingConvRef.current = conversationId;
    const assistantId = startAssistantMessage(conversationId, model, parentId);
    setStreamingId(assistantId);
    const controller = new AbortController();
    abortRef.current = controller;
    pendingChunkRef.current = "";
    let stoppedLoop = false;
    let failed = false;
    try {
      await streamChat(
        {
          provider: model.provider,
          transport: model.transport,
          host: settingsNow.ollamaHost,
          model: model.id,
          messages: payload,
          temperature: settingsNow.temperature,
          systemPrompt,
          contextLength: model.contextLength,
          modelSize: model.size,
          apiKey,
          accountId,
        },
        (chunk) => {
          if (controller.signal.aborted) return;
          pendingChunkRef.current += chunk;
          if (!flushTimerRef.current) {
            flushTimerRef.current = window.setTimeout(() => {
              flushTimerRef.current = null;
              flushPending(conversationId, assistantId);
            }, 80);
          }
          const nextLen =
            (useChatStore
              .getState()
              .conversations.find((c) => c.id === conversationId)
              ?.messages.find((m) => m.id === assistantId)?.content.length ?? 0) + pendingChunkRef.current.length;
          if (nextLen > 400_000) {
            stoppedLoop = true;
            pendingChunkRef.current = "";
            controller.abort();
          }
          completionTokensRef.current += Math.max(1, estimateTokens(chunk));
        },
        controller.signal,
        (usage) => {
          publishUsage(conversationId, usage.promptTokens, usage.completionTokens);
        },
      );
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        if (stoppedLoop) toast("Stopped a repeating reply");
      } else {
        failed = true;
        const message = err instanceof Error ? err.message : "The model failed to reply";
        if (isContextOverflowError(message)) {
          markContextExceeded(conversationId);
          toast.error("This model's context window is full");
        }
        flushPending(conversationId, assistantId);
        const current = useChatStore
          .getState()
          .conversations.find((c) => c.id === conversationId)
          ?.messages.find((m) => m.id === assistantId);
        if (!current?.content) {
          appendToMessage(
            conversationId,
            assistantId,
            isContextOverflowError(message)
              ? "The context window is full. You can keep chatting, but answers may be unexpected or inaccurate."
              : `I couldn't complete that reply. ${friendlyOllamaError(message)}`,
          );
        } else if (!isContextOverflowError(message)) {
          toast.error(friendlyOllamaError(message));
        }
      }
    } finally {
      if (!controller.signal.aborted || stoppedLoop) flushPending(conversationId, assistantId);
      else pendingChunkRef.current = "";
      setStreamingId(null);
      abortRef.current = null;
      if (streamingConvRef.current === conversationId) streamingConvRef.current = null;
      chatPersist.enabled = true;
    }
    const text =
      useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)
        ?.messages.find((m) => m.id === assistantId)?.content ?? "";
    if (!text) {
      if (cancelledRef.current) appendToMessage(conversationId, assistantId, "Stopped.");
      return "";
    }
    if (!failed && !text.startsWith("I couldn't complete")) {
      dropBinary(conversationId);
    }
    if (text && model.provider === "ollama" && !failed) {
      void countModelTokens({
        host: settingsNow.ollamaHost,
        model: model.id,
        text: text.slice(0, MAX_TURN_CHARS),
        transport: model.transport,
      }).then((n) => publishUsage(conversationId, promptTokensRef.current, n));
    }
    if (failed || text.startsWith("I couldn't complete") || text === "Stopped.") return "";
    return text;
  }

  function modelKey(model: ModelRef) {
    return `${model.provider}:${model.id}`;
  }

  function modelFromKey(key: string) {
    return models.find((m) => modelKey(m) === key);
  }

  function writerLabel(model: ModelRef) {
    const kind = model.provider === "ollama" ? "Ollama" : CLOUD_LABEL[model.provider];
    return `${model.name} · ${kind}`;
  }

  function visibleHistory(conversationId: string) {
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    if (!conv) return [] as { role: string; content: string; images?: string[]; documents?: Message["documents"] }[];
    return visibleMessages(conv.messages, conv.activeRootId)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content, images: m.images, documents: m.documents }));
  }

  function lastAssistantId(conversationId: string) {
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    if (!conv) return undefined;
    return [...visibleMessages(conv.messages, conv.activeRootId)]
      .reverse()
      .find((m) => m.role === "assistant")?.id;
  }

  async function send(text: string, extraFiles: PendingFile[] = files) {
    if (!useChatStore.getState().selectedModel) {
      toast.error("Choose a model first");
      return;
    }
    const built = buildMessageFromFiles(text, extraFiles);
    if (streamingId && streamingConvRef.current === conversation?.id) return;
    if (streamingId) abortRef.current?.abort();
    if (!built.content.trim() && !built.images?.length && !built.documents?.length) return;
    setDraft("");
    setFiles([]);
    stickToBottomRef.current = true;
    cancelledRef.current = false;
    const { conversationId, user } = addUserMessage(built.content, {
      images: built.images,
      documents: built.documents,
      attachments: built.attachments,
    });
    const history = visibleHistory(conversationId);
    const startHistory =
      history.length > 0
        ? history
        : [{ role: "user", content: built.content, images: built.images, documents: built.documents }];
    await runCompletion(conversationId, startHistory, user.id);
  }

  async function startReview() {
    if (streamingId && streamingConvRef.current === conversation?.id) return;
    if (streamingId) abortRef.current?.abort();
    const author = useChatStore.getState().selectedModel;
    const reviewer = modelFromKey(testerKey ?? "");
    if (!author) {
      toast.error("Choose a chat model first");
      return;
    }
    if (!reviewer) {
      toast.error("Pick a tester model");
      return;
    }
    if (modelKey(author) === modelKey(reviewer)) {
      toast.error("The tester must be a different model from the one in the header");
      return;
    }
    cancelledRef.current = false;
    stickToBottomRef.current = true;
    const pending = buildMessageFromFiles(draft, files);
    if (pending.content.trim() || pending.images?.length || pending.documents?.length) {
      setDraft("");
      setFiles([]);
      const { conversationId, user } = addUserMessage(pending.content, {
        images: pending.images,
        documents: pending.documents,
        attachments: pending.attachments,
      });
      await runReview(conversationId, user.id, visibleHistory(conversationId), reviewer, {
        begin: "writer",
      });
      return;
    }
    const conversationId = conversation?.id;
    if (!conversationId) {
      toast.error("Open a chat or type a prompt, then Start review");
      return;
    }
    const hist = visibleHistory(conversationId);
    if (hist.length === 0) {
      toast.error("Write something first, or type a prompt and click Start review");
      return;
    }
    const path = visibleMessages(
      useChatStore.getState().conversations.find((c) => c.id === conversationId)?.messages ?? [],
      useChatStore.getState().conversations.find((c) => c.id === conversationId)?.activeRootId,
    );
    const lastMsg = path.at(-1);
    if (!lastMsg) {
      toast.error("Write something first, or type a prompt and click Start review");
      return;
    }
    if (lastMsg.role === "assistant" && lastMsg.content.trim()) {
      await runReview(conversationId, lastMsg.id, hist, reviewer, {
        begin: "tester",
        seedProject: lastMsg.content,
      });
      return;
    }
    await runReview(conversationId, lastMsg.id, hist, reviewer, { begin: "writer" });
  }

  async function runReview(
    conversationId: string,
    userId: string,
    startHistory: ChatTurn[],
    reviewerStart: ModelRef,
    opts: { begin?: "writer" | "tester"; seedProject?: string } = {},
  ) {
    const max = Math.min(100, Math.max(1, cycles));
    let parentId = userId;
    let lastProject = opts.seedProject ?? "";
    let lastReview = "";
    let satisfied = false;
    const testerFirst = opts.begin === "tester" && Boolean(lastProject.trim());
    const original = [...startHistory].reverse().find((m) => m.role === "user") ?? startHistory[0];
    const originalText: ChatTurn = original
      ? { role: "user", content: clipTurn(original.content) }
      : { role: "user", content: "Review the work." };
    const originalWithMedia: ChatTurn = original
      ? {
          role: "user",
          content: clipTurn(original.content),
          images: original.images,
          documents: original.documents?.filter((d) => d.data),
        }
      : originalText;

    for (let i = 1; i <= max; i++) {
      if (cancelledRef.current) break;
      const author = useChatStore.getState().selectedModel;
      const reviewer = modelFromKey(testerKey ?? "") ?? reviewerStart;
      if (!author) {
        setCycleNote("Choose a chat model to keep writing");
        break;
      }
      if (modelKey(author) === modelKey(reviewer)) {
        toast.error("Writer and tester are the same model. Switch the chat model or pick another tester.");
        setCycleNote("Stopped: writer and tester match");
        break;
      }
      if (!(testerFirst && i === 1)) {
        setCycleNote(`Cycle ${i}/${max} · ${author.name} writing`);
        const writerTurns: ChatTurn[] =
          i === 1 && !testerFirst
            ? slimTurns(startHistory, true)
            : [
                originalText,
                ...(lastProject ? [{ role: "assistant", content: clipTurn(lastProject) }] : []),
                ...(lastReview
                  ? [{ role: "user", content: clipTurn(handoffToWriter(reviewer.name, lastReview)) }]
                  : []),
              ];
        const written = await runCompletion(conversationId, writerTurns, parentId, author);
        if (cancelledRef.current) {
          setCycleNote("Stopped");
          break;
        }
        if (!written.trim()) {
          setCycleNote(`${author.name} did not finish a reply`);
          break;
        }
        lastProject = written;
        parentId = lastAssistantId(conversationId) ?? parentId;
      } else {
        setCycleNote(`Cycle ${i}/${max} · testing the current answer`);
      }
      const reviewUser = addUserMessage(`Cycle ${i}/${max} · ${reviewer.name} testing`, {
        conversationId,
      });
      parentId = reviewUser.user.id;
      setCycleNote(`Cycle ${i}/${max} · ${reviewer.name} testing`);
      const testerTurns: ChatTurn[] = [
        i === 1 ? originalWithMedia : originalText,
        { role: "assistant", content: clipTurn(lastProject) },
        { role: "user", content: `Test the answer above. If it is good, start with SATISFIED.` },
      ];
      const review = await runCompletion(
        conversationId,
        testerTurns,
        parentId,
        reviewer,
        REVIEW_SYSTEM,
      );
      if (cancelledRef.current) {
        setCycleNote("Stopped");
        break;
      }
      parentId = lastAssistantId(conversationId) ?? parentId;
      lastReview = review;
      if (reviewSatisfied(review)) {
        satisfied = true;
        setCycleNote(`Stopped on cycle ${i}: ${reviewer.name} is satisfied`);
        toast.success(`${reviewer.name} is satisfied after ${i} cycle${i === 1 ? "" : "s"}`);
        break;
      }
      if (i === max) break;
      const revise = addUserMessage(`Cycle ${i}/${max} · ${author.name} revising`, { conversationId });
      parentId = revise.user.id;
    }
    if (!cancelledRef.current && !satisfied && lastProject.trim()) {
      const author = useChatStore.getState().selectedModel;
      const reviewer = modelFromKey(testerKey ?? "") ?? reviewerStart;
      if (author && reviewer && modelKey(author) !== modelKey(reviewer)) {
        setCycleNote(`${reviewer.name} writing final report`);
        const wrap = addUserMessage(`Final report from ${reviewer.name}`, { conversationId });
        await runCompletion(
          conversationId,
          [
            originalText,
            { role: "assistant", content: clipTurn(lastProject) },
            { role: "user", content: clipTurn(finalHandoff(author.name, lastProject)) },
          ],
          wrap.user.id,
          reviewer,
          FINAL_REVIEW_SYSTEM,
        );
        if (!cancelledRef.current) {
          setCycleNote(`Finished ${max} cycle${max === 1 ? "" : "s"} · tester left a final report`);
          toast.message(`${reviewer.name} left remaining issues with the project`);
        }
      }
    }
    window.setTimeout(() => setCycleNote(""), 8000);
  }

  function stop() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (!fileHint) return;
    const id = window.setTimeout(() => setFileHint(null), 5000);
    return () => window.clearTimeout(id);
  }, [fileHint]);

  async function ingestFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const next: PendingFile[] = [];
    const problems: string[] = [];
    for (const file of incoming) {
      const result = await readDroppedFile(file);
      if (result.ok) next.push(result.file);
      else problems.push(result.reason);
    }
    if (next.length) setFiles((cur) => [...cur, ...next]);
    if (problems.length) setFileHint(problems.join(" · "));
  }

  const fileAccept = "";

  function applyModel(model: ModelRef) {
    const used = conversation?.contextTokens ?? 0;
    const limit = model.contextLength;
    const hasChat = (conversation?.messages.length ?? 0) > 0;
    setSelectedModel(model);
    if (hasChat && limit && used >= limit) {
      markContextExceeded(conversation!.id);
      setSwitchWarn({ name: model.name, used, limit });
    } else {
      setSwitchWarn(null);
      if (conversation) {
        setUsage(
          conversation.id,
          {
            promptTokens: conversation.promptTokens,
            completionTokens: conversation.completionTokens,
          },
          false,
        );
      }
    }
  }

  function requestSwitch(model: ModelRef) {
    if (model.id === selectedModel?.id && model.provider === selectedModel.provider) return;
    const used = conversation?.contextTokens ?? 0;
    const limit = model.contextLength;
    const hasChat = (conversation?.messages.length ?? 0) > 0;
    if (hasChat && limit && used >= limit) {
      setPendingModel(model);
      return;
    }
    applyModel(model);
  }

  async function regenerate() {
    if (!conversation || streamingId) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const history = messages
      .filter((m) => m.id !== lastAssistant?.id)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content, images: m.images, documents: m.documents }));
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, lastUser.id);
  }

  async function retryFrom(messageId: string) {
    if (!conversation || streamingId) return;
    const user = conversation.messages.find((m) => m.id === messageId);
    if (!user || user.role !== "user") return;
    selectSibling(conversation.id, user.id);
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversation.id);
    if (!conv) return;
    const path = visibleMessages(conv.messages, conv.activeRootId).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const history = [];
    for (const m of path) {
      history.push({ role: m.role, content: m.content, images: m.images, documents: m.documents });
      if (m.id === user.id) break;
    }
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, user.id);
  }

  async function editFrom(messageId: string, content: string) {
    if (!conversation || streamingId) return;
    const user = forkUserMessage(conversation.id, messageId, content);
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversation.id);
    if (!conv) return;
    const path = visibleMessages(conv.messages, conv.activeRootId).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const history = [];
    for (const m of path) {
      history.push({ role: m.role, content: m.content, images: m.images, documents: m.documents });
      if (m.id === user.id) break;
    }
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, user.id);
  }

  function versionMeta(message: Message) {
    const sibs = siblingsOf(allMessages, message);
    const index = Math.max(0, sibs.findIndex((m) => m.id === message.id));
    return {
      index: index + 1,
      count: sibs.length,
      prevId: index > 0 ? sibs[index - 1]?.id : undefined,
      nextId: index < sibs.length - 1 ? sibs[index + 1]?.id : undefined,
    };
  }

  const thisStreaming = Boolean(streamingId) && streamingConvRef.current === conversation?.id;
  const empty = messages.length === 0;

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
      chatPersist.enabled = true;
    };
  }, []);

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void ingestFiles(e.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-none bg-background/80">
          <p className="rounded-2xl border border-border bg-card px-5 py-3 text-sm">
            Drop files to attach
          </p>
        </div>
      ) : null}
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 md:px-3">
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-5" />
        </Button>
        <ModelPicker
          models={models}
          value={selectedModel}
          onChange={requestSwitch}
          onBrowse={onBrowseModels}
        />
        <div className="ml-auto flex items-center gap-1">
          {conversation && conversation.messages.length > 0 ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete this chat"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
          <ContextMeter used={contextUsed} limit={contextLimit} />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {streamingId ? (
          <Button size="sm" variant="secondary" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => void startReview()} disabled={!selectedModel}>
            Start review
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Writer {selectedModel ? writerLabel(selectedModel) : "—"}
        </span>
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span>Tester</span>
          <ModelPicker
            models={models.filter(
              (m) =>
                !(
                  selectedModel &&
                  m.id === selectedModel.id &&
                  m.provider === selectedModel.provider
                ),
            )}
            value={
              models.find((m) => `${m.provider}:${m.id}` === testerKey) ?? null
            }
            onChange={(m) => setTesterKey(`${m.provider}:${m.id}`)}
            emptyLabel="Testing model…"
            className="h-8 max-w-[14rem] px-2 text-xs"
            allowCycle={false}
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Cycles
          <input
            type="number"
            min={1}
            max={100}
            className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-xs"
            value={cycles}
            onChange={(e) => setCycles(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        {cycleNote ? <span className="text-xs text-muted-foreground">{cycleNote}</span> : null}
      </div>
      <PairBar models={models} onBrowse={() => onBrowseModels?.()} />

      <div
        ref={scrollerRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
          stickToBottomRef.current = dist < 96;
        }}
      >
        {empty ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
            <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{greeting}</h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              {selectedModel
                ? `Talking with ${selectedModel.name}. Switch models anytime from the menu above.`
                : "Choose a model to begin."}
            </p>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!selectedModel}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm leading-6 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => {
              const version = versionMeta(message);
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={streamingId === message.id}
                  showRegen={message.id === lastAssistant?.id && !streamingId}
                  onRegenerate={regenerate}
                  onRetry={
                    message.role === "user" && !streamingId
                      ? () => void retryFrom(message.id)
                      : undefined
                  }
                  onEdit={
                    message.role === "user" && !streamingId
                      ? (content) => void editFrom(message.id, content)
                      : undefined
                  }
                  versionIndex={version.index}
                  versionCount={version.count}
                  onVersionPrev={
                    version.prevId && conversation && !streamingId
                      ? () => selectSibling(conversation.id, version.prevId!)
                      : undefined
                  }
                  onVersionNext={
                    version.nextId && conversation && !streamingId
                      ? () => selectSibling(conversation.id, version.nextId!)
                      : undefined
                  }
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {switchWarn ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              {switchWarn.name} has a smaller context window ({switchWarn.used.toLocaleString()}{" "}
              tokens in this chat, {switchWarn.limit.toLocaleString()} available). The full
              conversation is still passed over, but answers may be unexpected or inaccurate while
              the window is full.
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              New chat
            </Button>
          </div>
        </div>
      ) : null}

      {fileHint ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">{fileHint}</p>
        </div>
      ) : null}

      {contextFull && !switchWarn ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              This model's context window is full. You can keep chatting, but answers may be
              unexpected or inaccurate. Start a new chat to reset the window.
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              New chat
            </Button>
          </div>
        </div>
      ) : null}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={stop}
        streaming={thisStreaming}
        disabled={!selectedModel}
        placeholder={
          selectedModel ? `Message ${selectedModel.name}` : "Choose a model to begin"
        }
        files={files}
        onRemoveFile={(id) => setFiles((cur) => cur.filter((f) => f.id !== id))}
        onPickFiles={() => undefined}
        accept={fileAccept}
        onFileInput={(list) => {
          if (list) void ingestFiles(list);
        }}
      />
      <Dialog open={Boolean(pendingModel)} onOpenChange={(open) => !open && setPendingModel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This model has a smaller context window</DialogTitle>
            <DialogDescription>
              {pendingModel
                ? `${pendingModel.name} can hold about ${(pendingModel.contextLength ?? 0).toLocaleString()} tokens. This chat is already using ${(conversation?.contextTokens ?? 0).toLocaleString()} tokens. The whole conversation will still be sent, but answers may be unexpected or inaccurate because the new context window is full.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingModel(null)}>
              Keep current model
            </Button>
            <Button
              onClick={() => {
                if (pendingModel) applyModel(pendingModel);
                setPendingModel(null);
              }}
            >
              Switch anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              {conversation
                ? `“${conversation.title}” will be removed from history. This cannot be undone.`
                : "This chat will be removed from history."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (conversation) deleteConversation(conversation.id);
                setConfirmDelete(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
