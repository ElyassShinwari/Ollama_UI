import { useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Download,
  Moon,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { applyTheme, resolvedTheme } from "@/lib/theme";
import { t, type MsgKey } from "@/lib/i18n";
import { conversationMarkdown, conversationsBackup, downloadText } from "@/lib/chat/export";
import { useChatStore } from "@/lib/chat/store";
import type { Conversation } from "@/lib/chat/types";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupConversations(conversations: Conversation[], locale: string) {
  const now = startOfDay(Date.now());
  const day = 86400000;
  const groups: { labelKey: MsgKey; items: Conversation[] }[] = [
    { labelKey: "pinned", items: [] },
    { labelKey: "today", items: [] },
    { labelKey: "yesterday", items: [] },
    { labelKey: "previous7", items: [] },
    { labelKey: "older", items: [] },
  ];
  for (const c of conversations) {
    if (c.pinned) {
      groups[0]!.items.push(c);
      continue;
    }
    const dayStart = startOfDay(c.updatedAt);
    const delta = now - dayStart;
    if (delta < day) groups[1]!.items.push(c);
    else if (delta < day * 2) groups[2]!.items.push(c);
    else if (delta < day * 7) groups[3]!.items.push(c);
    else groups[4]!.items.push(c);
  }
  return groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({ label: t(locale, g.labelKey), items: g.items }));
}

export function Sidebar({
  className,
  onNewChat,
  onOpenSettings,
  onOpenStudio,
  onOpenNews,
  newsActive,
  studioActive,
  onNavigate,
}: {
  className?: string;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenStudio?: () => void;
  onOpenNews?: () => void;
  newsActive?: boolean;
  studioActive?: boolean;
  onNavigate?: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const search = useChatStore((s) => s.search);
  const setSearch = useChatStore((s) => s.setSearch);
  const [searchDraft, setSearchDraft] = useState(search);
  const setActive = useChatStore((s) => s.setActive);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const togglePin = useChatStore((s) => s.togglePin);
  const theme = useChatStore((s) => s.settings.theme);
  const locale = useChatStore((s) => s.settings.locale);
  const setSettings = useChatStore((s) => s.setSettings);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [title, setTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchDraft), 150);
    return () => window.clearTimeout(id);
  }, [searchDraft, setSearch]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered, locale), [filtered, locale]);

  return (
    <aside className={cn("flex h-full flex-col bg-sidebar", className)}>
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FlameMark />
          <span className="font-serif text-lg tracking-tight">Ollama UI</span>
        </div>
      </div>
      <div className="px-3 pb-3">
        <Button className="h-10 w-full justify-start gap-2" variant="secondary" onClick={onNewChat}>
          <Plus className="size-4" />
          {t(locale, "newChat")}
        </Button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t(locale, "searchChats")}
            className="h-9 bg-secondary/80 ps-9"
          />
        </div>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "emptyHistory")}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-3">
              <h2 className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((c) => (
                  <li key={c.id}>
                    <div
                      className={cn(
                        "group flex items-center rounded-lg pe-1",
                        c.id === activeId ? "bg-accent" : "hover:bg-accent/70",
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate px-2.5 py-2 text-start text-sm"
                        onClick={() => {
                          setActive(c.id);
                          onNavigate?.();
                        }}
                      >
                        {c.title}
                      </button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t(locale, "deleteNamed", { title: c.title })}
                        onClick={() => setPendingDelete(c)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t(locale, "conversationActions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              downloadText(
                                `${c.title.replace(/[^\w.-]+/g, "_") || "chat"}.md`,
                                conversationMarkdown(c),
                                "text/markdown;charset=utf-8",
                              );
                            }}
                          >
                            <Download className="size-4" />
                            {t(locale, "exportChat")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenaming(c);
                              setTitle(c.title);
                            }}
                          >
                            <Pencil className="size-4" />
                            {t(locale, "rename")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => togglePin(c.id)}>
                            {c.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                            {c.pinned ? t(locale, "unpin") : t(locale, "pin")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setPendingDelete(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            {t(locale, "delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>
      <div className="relative flex flex-col gap-1 overflow-visible border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2"
          onClick={() => {
            const next = resolvedTheme(theme) === "dark" ? "light" : "dark";
            setSettings({ theme: next });
            applyTheme(next);
          }}
        >
          {resolvedTheme(theme) === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {resolvedTheme(theme) === "dark" ? t(locale, "lightMode") : t(locale, "darkMode")}
        </Button>
        <Button
          variant="ghost"
          className={cn("h-10 w-full justify-start gap-2", newsActive && "bg-accent")}
          onClick={onOpenNews}
        >
          <Newspaper className="size-4" />
          {t(locale, "news")}
        </Button>
        <Button
          variant="ghost"
          className={cn("h-10 w-full justify-start gap-2", studioActive && "bg-accent")}
          onClick={onOpenStudio}
        >
          <Blocks className="size-4" />
          {t(locale, "studio")}
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          {t(locale, "settings")}
        </Button>
      </div>
      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(locale, "renameChat")}</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) {
                renameConversation(renaming.id, title.trim() || t(locale, "newChat"));
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              {t(locale, "cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!renaming) return;
                renameConversation(renaming.id, title.trim() || t(locale, "newChat"));
                setRenaming(null);
              }}
            >
              {t(locale, "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(locale, "deleteChat")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingDelete ? t(locale, "deleteChatBody", { title: pendingDelete.title }) : null}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t(locale, "cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                deleteConversation(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {t(locale, "delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export function FlameMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6" fill="currentColor" className="text-primary" />
      <path
        fill="currentColor"
        className="text-background"
        d="M12 4.5c2.7 3.4 4.8 5.6 4.8 8.4A4.8 4.8 0 1 1 7.2 12.9c0-2.8 2.1-5 4.8-8.4z"
      />
    </svg>
  );
}
