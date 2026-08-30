import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Menu, PanelLeft } from "lucide-react";
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
import { PairBar, BackgroundPulls } from "@/components/chat/pair-suggestions";
import { LanguagePicker } from "@/components/chat/language-picker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { estimateTokens, isContextOverflowError } from "@/lib/utils";
import { greetingKey, t } from "@/lib/i18n";
import { selectActiveConversation, chatPersist, useChatStore } from "@/lib/chat/store";
import { isPlaceholderModel } from "@/lib/chat/starter";
import { siblingsOf, visibleMessages, isNoteMessage, chatTurnsOf } from "@/lib/chat/tree";
import { adoptModel, streamChat } from "@/lib/llm/catalog";
import { endpointForModel, remoteIdFromCustom } from "@/lib/llm/custom";
import { useHistoryBack } from "@/lib/history-back";
import { friendlyOllamaError } from "@/lib/llm/context";
import {
  buildMessageFromFiles,
  readDroppedFile,
  type PendingFile,
} from "@/lib/llm/files";
import { repetitionCutoff } from "@/lib/llm/repeat";
import { formatChatPrompt } from "@/lib/llm/tokens";
import { combinedInstructions, knowledgeBlock, notifyN8n } from "@/lib/studio/store";
import {
  FINAL_REVIEW_SYSTEM,
  REVIEW_SELF_SYSTEM,
  REVIEW_SYSTEM,
  cloudSecret,
  finalHandoff,
  handoffToWriter,
  providerLabel,
  reviewSatisfied,
} from "@/lib/llm/cloud";
import type { Message, ModelRef } from "@/lib/chat/types";

const SUGGESTION_KEYS = ["suggestExplain", "suggestEmail", "suggestHoles", "suggestFunction"] as const;

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
  onRefreshModels,
}: {
  models: ModelRef[];
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onBrowseModels?: (query?: string) => void;
  onRefreshModels?: () => Promise<ModelRef[] | void>;
}) {
  const conversation = useChatStore(selectActiveConversation);
  const selectedModel = useChatStore((s) => s.selectedModel);
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
  const locale = useChatStore((s) => s.settings.locale);
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
  const [reviewOpen, setReviewOpen] = useState(false);
  useHistoryBack(reviewOpen, () => setReviewOpen(false), "review");
  const [farFromBottom, setFarFromBottom] = useState(false);
  const [liveAnnounce, setLiveAnnounce] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
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
  const liveRef = useRef("");
  const lastStoreLenRef = useRef(0);
  const flushCountRef = useRef(0);

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
    const turns = chatTurnsOf(visible);
    if (turns.length === 0) {
      useChatStore.getState().resetUsage(conversation.id);
      return;
    }
    const last = turns[turns.length - 1];
    const promptMsgs =
      last?.role === "assistant" ? turns.slice(0, -1) : turns;
    const completionText = last?.role === "assistant" ? last.content : "";
    let cancelled = false;
    void (async () => {
      const prompt = formatChatPrompt(
        [useChatStore.getState().settings.systemPrompt, combinedInstructions(), knowledgeBlock()]
          .filter(Boolean)
          .join("\n\n"),
        promptMsgs.map((m) => ({ role: m.role, content: m.content })),
      );
      if (cancelled) return;
      const promptTokens = estimateTokens(prompt);
      const completionTokens = estimateTokens(completionText);
      promptTokensRef.current = promptTokens;
      completionTokensRef.current = completionTokens;
      setUsage(conversation.id, { promptTokens, completionTokens });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, visibleKey, streamingId, setUsage]);

  const greeting = useMemo(() => t(locale, greetingKey()), [locale]);

  useEffect(() => {
    if (!selectedModel) return;
    const valid = models.some((m) => `${m.provider}:${m.id}` === testerKey);
    if (valid) return;
    const other = models.find(
      (m) => !(m.id === selectedModel.id && m.provider === selectedModel.provider),
    );
    const pick = other ?? selectedModel;
    setTesterKey(`${pick.provider}:${pick.id}`);
  }, [selectedModel, models, testerKey, setTesterKey]);

  function publishUsage(conversationId: string, promptTokens: number, completionTokens: number) {
    promptTokensRef.current = promptTokens;
    completionTokensRef.current = completionTokens;
    setUsage(conversationId, { promptTokens, completionTokens });
  }

  function flushPending(conversationId: string, assistantId: string, toStore = false) {
    if (flushTimerRef.current) {
      window.cancelAnimationFrame(flushTimerRef.current);
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const live = liveRef.current;
    setLiveText(live);
    flushCountRef.current += 1;
    const unsaved = live.slice(lastStoreLenRef.current);
    if (toStore || unsaved.length >= 1200 || flushCountRef.current % 16 === 0) {
      if (unsaved) {
        appendToMessage(conversationId, assistantId, unsaved);
        lastStoreLenRef.current = live.length;
      }
    }
    if (flushCountRef.current % 8 === 0) {
      const cut = repetitionCutoff(live);
      if (cut != null) {
        const kept = live.slice(0, cut).trimEnd();
        liveRef.current = kept;
        pendingChunkRef.current = "";
        setLiveText(kept);
        replaceMessageContent(conversationId, assistantId, kept);
        lastStoreLenRef.current = kept.length;
        abortRef.current?.abort();
      }
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
    if (!model || isPlaceholderModel(model)) {
      toast.error(t(useChatStore.getState().settings.locale, "chooseModelFirstToast"));
      return "";
    }
    const settingsNow = useChatStore.getState().settings;
    const custom = endpointForModel(settingsNow.customEndpoints, model);
    const apiKey = custom ? custom.apiKey : cloudSecret(settingsNow, model.provider) || undefined;
    const accountId =
      model.provider === "openai" ? settingsNow.openaiOAuth?.accountId : undefined;
    const modelId = custom ? remoteIdFromCustom(model.id, custom.id) : model.id;
    const systemPrompt = [settingsNow.systemPrompt, combinedInstructions(), knowledgeBlock(), extraSystem]
      .filter(Boolean)
      .join("\n\n");
    const payload = slimTurns(
      history,
      history.some((m) => Boolean(m.images?.length || m.documents?.some((d) => d.data))),
    );

    chatPersist.enabled = false;
    streamingConvRef.current = conversationId;
    const assistantId = startAssistantMessage(conversationId, model, parentId);
    setStreamingId(assistantId);
    setLiveText("");
    liveRef.current = "";
    lastStoreLenRef.current = 0;
    flushCountRef.current = 0;
    const controller = new AbortController();
    abortRef.current = controller;
    pendingChunkRef.current = "";
    let painted = false;
    let stoppedLoop = false;
    let failed = false;
    try {
      await streamChat(
        {
          provider: model.provider,
          transport: model.transport,
          host: settingsNow.ollamaHost,
          model: modelId,
          messages: payload,
          temperature: settingsNow.temperature,
          systemPrompt,
          contextLength: model.contextLength,
          modelSize: model.size,
          apiKey,
          accountId,
          baseUrl: custom?.baseUrl,
        },
        (chunk) => {
          if (controller.signal.aborted) return;
          liveRef.current += chunk;
          pendingChunkRef.current = liveRef.current;
          if (liveRef.current.length > 400_000) {
            stoppedLoop = true;
            controller.abort();
            return;
          }
          if (!painted) {
            painted = true;
            flushPending(conversationId, assistantId);
          } else if (!flushTimerRef.current) {
            flushTimerRef.current = window.requestAnimationFrame(() => {
              flushTimerRef.current = null;
              flushPending(conversationId, assistantId);
            });
          }
        },
        controller.signal,
        (usage) => {
          publishUsage(conversationId, usage.promptTokens, usage.completionTokens);
        },
      );
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        if (stoppedLoop) toast(t(useChatStore.getState().settings.locale, "stoppedRepeating"));
      } else {
        failed = true;
        const loc = useChatStore.getState().settings.locale;
        const message = err instanceof Error ? err.message : t(loc, "modelFailed");
        if (isContextOverflowError(message)) {
          markContextExceeded(conversationId);
          toast.error(t(loc, "contextWindowFull"));
        }
        flushPending(conversationId, assistantId, true);
        const current = useChatStore
          .getState()
          .conversations.find((c) => c.id === conversationId)
          ?.messages.find((m) => m.id === assistantId);
        if (!current?.content && !liveRef.current) {
          appendToMessage(
            conversationId,
            assistantId,
            isContextOverflowError(message)
              ? t(loc, "contextFullReply")
              : t(loc, "couldntComplete", { error: friendlyOllamaError(message) }),
          );
        } else if (!isContextOverflowError(message)) {
          toast.error(friendlyOllamaError(message));
        }
      }
    } finally {
      if (!controller.signal.aborted || stoppedLoop) flushPending(conversationId, assistantId, true);
      else pendingChunkRef.current = "";
      if (liveRef.current && lastStoreLenRef.current < liveRef.current.length) {
        appendToMessage(conversationId, assistantId, liveRef.current.slice(lastStoreLenRef.current));
        lastStoreLenRef.current = liveRef.current.length;
      }
      setStreamingId(null);
      setLiveText("");
      abortRef.current = null;
      if (streamingConvRef.current === conversationId) streamingConvRef.current = null;
      chatPersist.enabled = true;
      if (!promptTokensRef.current) {
        publishUsage(conversationId, estimateTokens(payload.map((m) => m.content).join("\n")), estimateTokens(liveRef.current));
      }
    }
    const text =
      useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)
        ?.messages.find((m) => m.id === assistantId)?.content ?? "";
    const loc = useChatStore.getState().settings.locale;
    if (!text) {
      if (cancelledRef.current) appendToMessage(conversationId, assistantId, t(loc, "stopped"));
      dropBinary(conversationId);
      return "";
    }
    dropBinary(conversationId);
    if (!failed && !cancelledRef.current) {
      setLiveAnnounce(t(loc, "replyReady"));
      const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      notifyN8n({
        event: "assistant",
        user: lastUser,
        assistant: text,
        model: model.id,
        conversationId,
      });
    }
    if (failed || cancelledRef.current) return failed ? "" : text;
    return text;
  }

  function modelKey(model: ModelRef) {
    return `${model.provider}:${model.id}`;
  }

  function modelFromKey(key: string) {
    return models.find((m) => modelKey(m) === key);
  }

  function writerLabel(model: ModelRef) {
    if (isPlaceholderModel(model)) return t(locale, "chooseModel");
    const kind = model.provider === "ollama" ? "Ollama" : providerLabel(model.provider);
    return `${model.name} · ${kind}`;
  }

  function visibleHistory(conversationId: string) {
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    if (!conv) return [] as { role: string; content: string; images?: string[]; documents?: Message["documents"] }[];
    return visibleMessages(conv.messages, conv.activeRootId)
      .filter((m) => !isNoteMessage(m) && (m.role === "user" || m.role === "assistant"))
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
    if (!useChatStore.getState().selectedModel || isPlaceholderModel(useChatStore.getState().selectedModel)) {
      toast.error(t(useChatStore.getState().settings.locale, "chooseModelFirstToast"));
      return;
    }
    const built = buildMessageFromFiles(text, extraFiles);
    if (streamingId && streamingConvRef.current === conversation?.id) return;
    if (streamingId) {
      toast.error(t(locale, "streamOtherChat"));
      return;
    }
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
    if (streamingId) {
      toast.error(t(locale, "streamOtherChat"));
      return;
    }
    const author = useChatStore.getState().selectedModel;
    const reviewer = modelFromKey(testerKey ?? "");
    if (!author || isPlaceholderModel(author)) {
      toast.error(t(locale, "chooseChatModelFirst"));
      return;
    }
    if (!reviewer) {
      toast.error(t(locale, "pickTester"));
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
      toast.error(t(locale, "reviewNeedChat"));
      return;
    }
    const hist = visibleHistory(conversationId);
    if (hist.length === 0) {
      toast.error(t(locale, "reviewNeedPrompt"));
      return;
    }
    const path = visibleMessages(
      useChatStore.getState().conversations.find((c) => c.id === conversationId)?.messages ?? [],
      useChatStore.getState().conversations.find((c) => c.id === conversationId)?.activeRootId,
    );
    const lastMsg = path.at(-1);
    if (!lastMsg) {
      toast.error(t(locale, "reviewNeedPrompt"));
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
        setCycleNote(t(locale, "cycleChooseWriter"));
        break;
      }
      const sameReview = modelKey(author) === modelKey(reviewer);
      if (!(testerFirst && i === 1)) {
        setCycleNote(t(locale, "cycleWriting", { i: String(i), max: String(max), name: author.name }));
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
          setCycleNote(t(locale, "cycleStopped"));
          break;
        }
        if (!written.trim()) {
          setCycleNote(t(locale, "cycleNoReply", { name: author.name }));
          break;
        }
        lastProject = written;
        parentId = lastAssistantId(conversationId) ?? parentId;
      } else {
        setCycleNote(t(locale, "cycleTestingCurrent", { i: String(i), max: String(max) }));
      }
      const reviewUser = addUserMessage(
        t(locale, "cycleTesting", { i: String(i), max: String(max), name: reviewer.name }),
        {
          conversationId,
          role: "note",
        },
      );
      parentId = reviewUser.user.id;
      setCycleNote(t(locale, "cycleTesting", { i: String(i), max: String(max), name: reviewer.name }));
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
        sameReview ? REVIEW_SELF_SYSTEM : REVIEW_SYSTEM,
      );
      if (cancelledRef.current) {
        setCycleNote(t(locale, "cycleStopped"));
        break;
      }
      parentId = lastAssistantId(conversationId) ?? parentId;
      lastReview = review;
      if (reviewSatisfied(review)) {
        satisfied = true;
        setCycleNote(t(locale, "cycleSatisfied", { i: String(i), name: reviewer.name }));
        toast.success(
          t(locale, i === 1 ? "cycleSatisfiedToast" : "cycleSatisfiedToastPlural", {
            name: reviewer.name,
            i: String(i),
          }),
        );
        break;
      }
      if (i === max) break;
      const revise = addUserMessage(
        t(locale, "cycleRevising", { i: String(i), max: String(max), name: author.name }),
        {
          conversationId,
          role: "note",
        },
      );
      parentId = revise.user.id;
    }
    if (!cancelledRef.current && !satisfied && lastProject.trim()) {
      const author = useChatStore.getState().selectedModel;
      const reviewer = modelFromKey(testerKey ?? "") ?? reviewerStart;
      if (author && reviewer) {
        setCycleNote(t(locale, "cycleFinishing", { name: reviewer.name }));
        const wrap = addUserMessage(t(locale, "cycleFinishedBy", { name: reviewer.name }), {
          conversationId,
          role: "note",
        });
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
          setCycleNote(
            t(locale, max === 1 ? "cycleFinishedNote" : "cycleFinishedNotePlural", {
              max: String(max),
              name: reviewer.name,
            }),
          );
          toast.message(t(locale, "cycleFinishedToast", { name: reviewer.name }));
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

  function stopStream() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  function applyModel(model: ModelRef) {
    const used = conversation?.contextTokens ?? 0;
    const limit = model.contextLength;
    const hasChat = (conversation?.messages.length ?? 0) > 0;
    adoptModel(model);
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
    if (streamingId) stopStream();
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
      .filter((m) => !isNoteMessage(m) && (m.role === "user" || m.role === "assistant"))
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
      (m) => !isNoteMessage(m) && (m.role === "user" || m.role === "assistant"),
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
      (m) => !isNoteMessage(m) && (m.role === "user" || m.role === "assistant"),
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
  const retryFromRef = useRef(retryFrom);
  retryFromRef.current = retryFrom;
  const editFromRef = useRef(editFrom);
  editFromRef.current = editFrom;
  const regenerateRef = useRef(regenerate);
  regenerateRef.current = regenerate;
  const onRetry = useCallback((id: string) => {
    void retryFromRef.current(id);
  }, []);
  const onEdit = useCallback((id: string, content: string) => {
    void editFromRef.current(id, content);
  }, []);
  const onRegenerate = useCallback(() => {
    void regenerateRef.current();
  }, []);
  const onSelectSibling = useCallback((id: string) => {
    const cid = useChatStore.getState().activeId;
    if (cid) selectSibling(cid, id);
  }, [selectSibling]);

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
            {t(locale, "dropFiles")}
          </p>
        </div>
      ) : null}
      <header className="relative z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 overflow-visible px-2 pt-[env(safe-area-inset-top)] md:px-3">
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 md:hidden"
          onClick={onOpenSidebar}
          aria-label={t(locale, "openSidebar")}
        >
          <Menu className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden shrink-0 md:inline-flex"
          onClick={onToggleSidebar}
          aria-label={t(locale, "toggleSidebar")}
        >
          <PanelLeft className="size-5" />
        </Button>
        <ModelPicker
          models={models}
          value={selectedModel}
          onChange={requestSwitch}
          onBrowse={onBrowseModels}
        />
        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 shrink-0 px-2.5 md:hidden"
            onClick={() => setReviewOpen(true)}
            disabled={!selectedModel || isPlaceholderModel(selectedModel)}
          >
            {t(locale, "review")}
          </Button>
          <LanguagePicker variant="header" />
          <ContextMeter used={contextUsed} limit={contextLimit} />
        </div>
      </header>
      <div className="hidden flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:flex">
        {streamingId ? (
          <Button size="sm" variant="secondary" onClick={stop}>
            {t(locale, "stop")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => void startReview()} disabled={!selectedModel || isPlaceholderModel(selectedModel)}>
            {t(locale, "startReview")}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {t(locale, "writer")} {selectedModel ? writerLabel(selectedModel) : "—"}
        </span>
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span>{t(locale, "tester")}</span>
          <ModelPicker
            models={models}
            value={
              models.find((m) => `${m.provider}:${m.id}` === testerKey) ?? null
            }
            onChange={(m) => setTesterKey(`${m.provider}:${m.id}`)}
            emptyLabel={t(locale, "testingModel")}
            className="h-8 max-w-[14rem] px-2 text-xs"
            allowCycle={false}
          />
          <Button
            size="sm"
            variant={
              selectedModel && testerKey === `${selectedModel.provider}:${selectedModel.id}`
                ? "secondary"
                : "outline"
            }
            className="h-8"
            disabled={!selectedModel}
            onClick={() => {
              if (!selectedModel) return;
              const key = `${selectedModel.provider}:${selectedModel.id}`;
              if (testerKey === key) {
                const other = models.find(
                  (m) => !(m.id === selectedModel.id && m.provider === selectedModel.provider),
                );
                if (other) setTesterKey(`${other.provider}:${other.id}`);
                return;
              }
              setTesterKey(key);
            }}
          >
            {t(locale, "sameModel")}
          </Button>
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {t(locale, "cycles")}
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
      <div className="mx-auto w-full max-w-3xl px-3 pt-2 md:hidden">
        {streamingId ? (
          <Button size="sm" variant="secondary" className="w-full" onClick={stop}>
            {t(locale, "stop")}
          </Button>
        ) : null}
      </div>
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="bottom" className="gap-3 p-4">
          <SheetTitle>{t(locale, "review")}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {t(locale, "writer")} {selectedModel ? writerLabel(selectedModel) : "—"}
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">{t(locale, "tester")}</span>
            <ModelPicker
              models={models}
              value={models.find((m) => `${m.provider}:${m.id}` === testerKey) ?? null}
              onChange={(m) => setTesterKey(`${m.provider}:${m.id}`)}
              emptyLabel={t(locale, "testingModel")}
              className="h-10 w-full justify-between px-3"
              allowCycle={false}
            />
            <Button
              variant={
                selectedModel && testerKey === `${selectedModel.provider}:${selectedModel.id}`
                  ? "secondary"
                  : "outline"
              }
              disabled={!selectedModel}
              onClick={() => {
                if (!selectedModel) return;
                const key = `${selectedModel.provider}:${selectedModel.id}`;
                if (testerKey === key) {
                  const other = models.find(
                    (m) => !(m.id === selectedModel.id && m.provider === selectedModel.provider),
                  );
                  if (other) setTesterKey(`${other.provider}:${other.id}`);
                  return;
                }
                setTesterKey(key);
              }}
            >
              {t(locale, "sameModel")}
            </Button>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t(locale, "cycles")}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={t(locale, "decreaseCycles")}
                  onClick={() => setCycles((n) => Math.max(1, n - 1))}
                >
                  −
                </Button>
                <span className="w-8 text-center font-mono tabular-nums">{cycles}</span>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={t(locale, "increaseCycles")}
                  onClick={() => setCycles((n) => Math.min(100, n + 1))}
                >
                  +
                </Button>
              </div>
            </div>
            <Button
              disabled={!selectedModel || isPlaceholderModel(selectedModel) || Boolean(streamingId)}
              className="min-h-11"
              onClick={() => {
                setReviewOpen(false);
                void startReview();
              }}
            >
              {t(locale, "startReview")}
            </Button>
            <PairBar
              models={models}
              onBrowse={() => onBrowseModels?.()}
              onRefreshLocal={onRefreshModels}
              className="block border-0 px-0 py-1 md:hidden"
            />
          </div>
        </SheetContent>
      </Sheet>
      <PairBar models={models} onBrowse={() => onBrowseModels?.()} onRefreshLocal={onRefreshModels} />

      <div
        ref={scrollerRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(e) => {
          const el = e.currentTarget;
          const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
          stickToBottomRef.current = dist < 96;
          setFarFromBottom(dist > 96);
        }}
      >
        {empty ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
            <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{greeting}</h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              {selectedModel && !isPlaceholderModel(selectedModel)
                ? t(locale, "talkingWith", { name: selectedModel.name })
                : t(locale, "chooseModelFirst")}
            </p>
            {isPlaceholderModel(selectedModel) && onBrowseModels ? (
              <Button className="mt-6 min-h-11 self-start" onClick={() => onBrowseModels()}>
                {t(locale, "chooseModel")}
              </Button>
            ) : null}
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={!selectedModel || isPlaceholderModel(selectedModel)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-start text-sm leading-6 transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void send(t(locale, key))}
                >
                  {t(locale, key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => {
              if (isNoteMessage(message)) {
                return (
                  <p
                    key={message.id}
                    className="mx-auto max-w-lg px-2 text-center text-xs text-muted-foreground"
                  >
                    {message.content}
                  </p>
                );
              }
              const version = versionMeta(message);
              return (
                <MessageBubble
                  key={message.id}
                  message={
                    streamingId === message.id && liveText
                      ? { ...message, content: liveText }
                      : message
                  }
                  streaming={streamingId === message.id}
                  showRegen={message.id === lastAssistant?.id && !streamingId}
                  onRegenerate={onRegenerate}
                  onRetry={
                    message.role === "user" && !streamingId ? onRetry : undefined
                  }
                  onEdit={
                    message.role === "user" && !streamingId ? onEdit : undefined
                  }
                  versionIndex={version.index}
                  versionCount={version.count}
                  prevId={!streamingId ? version.prevId : undefined}
                  nextId={!streamingId ? version.nextId : undefined}
                  onSelectSibling={onSelectSibling}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      {farFromBottom && !empty ? (
        <button
          type="button"
          className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-2 text-xs shadow-[var(--composer-shadow)]"
          onClick={() => {
            stickToBottomRef.current = true;
            setFarFromBottom(false);
            bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
          }}
        >
          <ChevronDown className="me-1 inline size-3.5" />
          {t(locale, "jumpToLatest")}
        </button>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {liveAnnounce}
      </div>

      {switchWarn ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              {t(locale, "switchWarnBanner", {
                name: switchWarn.name,
                used: switchWarn.used.toLocaleString(),
                limit: switchWarn.limit.toLocaleString(),
              })}
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              {t(locale, "newChat")}
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
              {t(locale, "contextFullBanner")}
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              {t(locale, "newChat")}
            </Button>
          </div>
        </div>
      ) : null}

      <BackgroundPulls />

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={stop}
        streaming={thisStreaming}
        disabled={!selectedModel || isPlaceholderModel(selectedModel)}
        placeholder={
          selectedModel && !isPlaceholderModel(selectedModel)
            ? t(locale, "messagePh", { name: selectedModel.name })
            : t(locale, "chooseModelFirst")
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
            <DialogTitle>{t(locale, "smallerWindowTitle")}</DialogTitle>
            <DialogDescription>
              {pendingModel
                ? t(locale, "smallerWindowBody", {
                    name: pendingModel.name,
                    limit: (pendingModel.contextLength ?? 0).toLocaleString(),
                    used: (conversation?.contextTokens ?? 0).toLocaleString(),
                  })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingModel(null)}>
              {t(locale, "keepCurrentModel")}
            </Button>
            <Button
              onClick={() => {
                if (pendingModel) applyModel(pendingModel);
                setPendingModel(null);
              }}
            >
              {t(locale, "switchAnyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
