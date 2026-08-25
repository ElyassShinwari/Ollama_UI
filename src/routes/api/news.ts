import { createFileRoute } from "@tanstack/react-router";
import {
  decodeXml,
  feedsFor,
  mergeNews,
  parseRss,
  type NewsItem,
  type NewsTopic,
} from "@/lib/news/feeds";

const TOPICS: NewsTopic[] = ["local", "ai", "pictures", "videos"];
const cache = new Map<NewsTopic, { at: number; items: NewsItem[] }>();
const TTL = 5 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function fetchFeed(url: string, source?: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRss(xml, source);
}

const OG_IMAGE = [
  /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
];

async function fillImages(items: NewsItem[]): Promise<NewsItem[]> {
  const targets = items
    .filter((item) => !item.image && !/news\.google\.com/i.test(item.link))
    .slice(0, 10);
  await Promise.all(
    targets.map(async (item) => {
      try {
        const res = await fetch(item.link, {
          headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
          redirect: "follow",
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const html = await res.text();
        for (const re of OG_IMAGE) {
          const match = re.exec(html);
          const url = match?.[1] ? decodeXml(match[1]).trim() : "";
          if (url.startsWith("http")) {
            item.image = url;
            break;
          }
        }
      } catch {
        // publisher blocked the preview fetch
      }
    }),
  );
  return items;
}

async function loadTopic(topic: NewsTopic, fresh: boolean): Promise<NewsItem[]> {
  if (fresh) cache.delete(topic);
  const hit = cache.get(topic);
  if (hit && Date.now() - hit.at < TTL) return hit.items;
  const groups = await Promise.all(
    feedsFor(topic).map((feed) =>
      fetchFeed(feed.url, feed.source).catch(() => [] as NewsItem[]),
    ),
  );
  let items = mergeNews(groups, topic);
  if (topic === "pictures") {
    items = mergeNews([await fillImages(items)], "pictures");
  }
  cache.set(topic, { at: Date.now(), items });
  return items;
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("topic") || "local";
        const topic = TOPICS.includes(raw as NewsTopic) ? (raw as NewsTopic) : "local";
        const fresh = url.searchParams.get("fresh") === "1";
        try {
          const items = await loadTopic(topic, fresh);
          return Response.json({ topic, items });
        } catch (err) {
          return Response.json(
            { topic, items: [], error: err instanceof Error ? err.message : "News is unavailable" },
            { status: 200 },
          );
        }
      },
    },
  },
});
