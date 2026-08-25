import { useEffect, useState } from "react";
import { ExternalLink, ImageIcon, LoaderCircle, Menu, Newspaper, Play, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NEWS_TOPICS, relativeTime, youtubeId, type NewsItem, type NewsTopic } from "@/lib/news/feeds";
import { cn } from "@/lib/utils";

export function NewsPanel({
  onClose,
  onOpenSidebar,
}: {
  onClose: () => void;
  onOpenSidebar?: () => void;
}) {
  const [topic, setTopic] = useState<NewsTopic>("local");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<NewsItem | null>(null);
  const nested = typeof window !== "undefined" && window.self !== window.top;

  async function load(next: NewsTopic, fresh = false) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/news?topic=${next}${fresh ? "&fresh=1" : ""}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { items?: NewsItem[]; error?: string };
      setItems(json.items ?? []);
      if (json.error) setError(json.error);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not load news");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPlaying(null);
    setItems([]);
    setBusy(true);
    setError("");
    void (async () => {
      try {
        const res = await fetch(`/api/news?topic=${topic}`, { cache: "no-store" });
        const json = (await res.json()) as { items?: NewsItem[]; error?: string };
        if (cancelled) return;
        setItems(json.items ?? []);
        if (json.error) setError(json.error);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load news");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  const hint = NEWS_TOPICS.find((t) => t.id === topic)?.hint ?? "";
  const pictures = topic === "pictures";
  const videos = topic === "videos";
  const withImages = items.filter((item) => item.image);
  const showGrid = pictures || videos;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {onOpenSidebar ? (
              <Button
                size="icon"
                variant="ghost"
                className="mt-1 md:hidden"
                onClick={onOpenSidebar}
                aria-label="Open sidebar"
              >
                <Menu className="size-5" />
              </Button>
            ) : null}
            <div>
              <h1 className="font-serif text-4xl tracking-tight">News</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground text-pretty">
                A live feed of local models and the wider AI world. Choose a topic, then open a story or play a video here.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Refresh news"
              disabled={busy}
              onClick={() => void load(topic, true)}
            >
              <RefreshCw className={cn("size-4", busy && "animate-spin")} />
            </Button>
            <Button variant="outline" onClick={onClose}>
              Back to chat
            </Button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {NEWS_TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={topic === item.id}
              onClick={() => setTopic(item.id)}
              className={cn(
                "rounded-2xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent",
                topic === item.id && "bg-accent ring-1 ring-ring",
              )}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground text-pretty">{item.hint}</span>
            </button>
          ))}
        </div>
        <p className="mb-6 text-xs text-muted-foreground">{hint}</p>

        {playing && videos ? <VideoStage item={playing} onClose={() => setPlaying(null)} /> : null}

        {busy && items.length === 0 ? (
          <NewsSkeleton grid={showGrid} />
        ) : error && items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No stories in this feed right now. Try another option or refresh.
          </p>
        ) : showGrid && (videos || withImages.length > 0) ? (
          <MediaGrid
            items={videos ? items : withImages}
            videos={videos}
            playingId={playing?.id}
            onPlay={
              videos
                ? (item) => {
                    if (nested || !youtubeId(item.link)) {
                      window.open(item.link, "_blank", "noopener,noreferrer");
                      return;
                    }
                    setPlaying(item);
                  }
                : undefined
            }
          />
        ) : (
          <StoryList items={items} />
        )}
      </div>
    </div>
  );
}

function NewsSkeleton({ grid }: { grid: boolean }) {
  if (grid) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-video rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading feed…
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          <Skeleton className="hidden h-20 w-28 shrink-0 rounded-xl sm:block" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryList({ items }: { items: NewsItem[] }) {
  const [lead, ...rest] = items;
  return (
    <div className="flex flex-col gap-2">
      {lead ? <LeadStory item={lead} /> : null}
      {rest.map((item) => (
        <StoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function LeadStory({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-2 overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:bg-accent"
    >
      {item.image ? (
        <Thumb src={item.image} className="aspect-[16/7] w-full object-cover" />
      ) : null}
      <span className="block p-4 sm:p-5">
        <span className="block font-serif text-2xl tracking-tight text-pretty group-hover:underline">
          {item.title}
        </span>
        {item.excerpt ? (
          <span className="mt-2 line-clamp-3 block text-sm text-muted-foreground">{item.excerpt}</span>
        ) : null}
        <Meta item={item} />
      </span>
    </a>
  );
}

function StoryCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent"
    >
      {item.image ? (
        <Thumb src={item.image} className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block" />
      ) : (
        <span className="hidden h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:flex">
          <Newspaper className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-pretty group-hover:underline">{item.title}</span>
        {item.excerpt ? (
          <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{item.excerpt}</span>
        ) : null}
        <Meta item={item} />
      </span>
    </a>
  );
}

function MediaGrid({
  items,
  videos,
  playingId,
  onPlay,
}: {
  items: NewsItem[];
  videos: boolean;
  playingId?: string;
  onPlay?: (item: NewsItem) => void;
}) {
  const shown = items.slice(0, 24);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((item) => {
        const playable = videos && Boolean(youtubeId(item.link));
        const className = cn(
          "group overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:bg-accent",
          playingId === item.id && "ring-1 ring-ring",
        );
        const body = (
          <>
            <span className="relative block aspect-video bg-muted">
              {item.image ? (
                <Thumb src={item.image} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground">
                  {videos ? <Play className="size-8" /> : <ImageIcon className="size-8" />}
                </span>
              )}
              {videos ? (
                <span className="absolute inset-0 flex items-center justify-center bg-background/20">
                  <span className="flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground">
                    <Play className="size-5" />
                  </span>
                </span>
              ) : null}
            </span>
            <span className="block p-3">
              <span className="line-clamp-2 font-medium text-pretty group-hover:underline">{item.title}</span>
              <span className="mt-2 block text-xs text-muted-foreground">
                {item.source}
                {item.publishedAt ? ` · ${relativeTime(item.publishedAt)}` : ""}
              </span>
            </span>
          </>
        );
        if (playable && onPlay) {
          return (
            <button key={item.id} type="button" className={className} onClick={() => onPlay(item)}>
              {body}
            </button>
          );
        }
        return (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {body}
          </a>
        );
      })}
    </div>
  );
}

function VideoStage({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const id = youtubeId(item.link);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={item.title}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-border"
        onClick={(event) => event.stopPropagation()}
      >
      {id ? (
        <div className="aspect-video bg-muted">
          <iframe
            title={item.title}
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            className="size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="font-medium text-pretty">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.source}
            {item.publishedAt ? ` · ${relativeTime(item.publishedAt)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" asChild>
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              YouTube
            </a>
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Close video" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{item.source}</span>
      {item.publishedAt ? <span>· {relativeTime(item.publishedAt)}</span> : null}
      <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </span>
  );
}

function Thumb({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
