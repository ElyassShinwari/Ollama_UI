import { useMemo, useState } from "react";
import {
  Moon,
  MoreHorizontal,
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
import { useChatStore } from "@/lib/chat/store";
import type { Conversation } from "@/lib/chat/types";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupConversations(conversations: Conversation[]) {
  const now = startOfDay(Date.now());
  const day = 86400000;
  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
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
  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  className,
  onNewChat,
  onOpenSettings,
  onNavigate,
}: {
  className?: string;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onNavigate?: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const search = useChatStore((s) => s.search);
  const setSearch = useChatStore((s) => s.setSearch);
  const setActive = useChatStore((s) => s.setActive);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const togglePin = useChatStore((s) => s.togglePin);
  const theme = useChatStore((s) => s.settings.theme);
  const setSettings = useChatStore((s) => s.setSettings);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [title, setTitle] = useState("");

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

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  return (
    <aside className={cn("flex h-full flex-col bg-sidebar", className)}>
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FlameMark />
          <span className="font-serif text-lg tracking-tight">Ollama UI</span>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onNewChat} aria-label="New chat">
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="px-3 pb-3">
        <Button className="h-10 w-full justify-start gap-2" variant="secondary" onClick={onNewChat}>
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="h-9 bg-secondary/80 pl-9"
          />
        </div>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            Saved conversations will live here.
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
                        "group flex items-center rounded-lg pr-1",
                        c.id === activeId ? "bg-accent" : "hover:bg-accent/70",
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm"
                        onClick={() => {
                          setActive(c.id);
                          onNavigate?.();
                        }}
                      >
                        {c.title}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Conversation actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRenaming(c);
                              setTitle(c.title);
                            }}
                          >
                            <Pencil className="size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => togglePin(c.id)}>
                            {c.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                            {c.pinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => deleteConversation(c.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
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
      <div className="flex flex-col gap-1 border-t border-border p-3">
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
          {resolvedTheme(theme) === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) {
                renameConversation(renaming.id, title.trim() || "New chat");
                setRenaming(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!renaming) return;
                renameConversation(renaming.id, title.trim() || "New chat");
                setRenaming(null);
              }}
            >
              Save
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
