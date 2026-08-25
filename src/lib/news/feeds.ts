export type NewsTopic = "local" | "ai" | "pictures" | "videos";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  excerpt: string;
  image?: string;
  video?: boolean;
};

export const NEWS_TOPICS: { id: NewsTopic; label: string; hint: string }[] = [
  { id: "local", label: "Local AI", hint: "Ollama, llama.cpp, GGUF, and on-device models" },
  { id: "ai", label: "Overall AI", hint: "Labs, products, research, and policy" },
  { id: "pictures", label: "Pictures", hint: "Image models, AI art, and visual news" },
  { id: "videos", label: "Videos", hint: "Talks, explainers, and demos" },
];

const GOOGLE = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

const FEEDS: Record<NewsTopic, { url: string; source?: string }[]> = {
  local: [
    { url: GOOGLE('Ollama OR "local LLM" OR "on-device AI" OR llama.cpp OR GGUF OR "LM Studio" when:14d') },
    { url: "https://huggingface.co/blog/feed.xml", source: "Hugging Face" },
    { url: "https://www.reddit.com/r/LocalLLaMA/.rss", source: "r/LocalLLaMA" },
    { url: "https://www.reddit.com/r/Ollama/.rss", source: "r/Ollama" },
  ],
  ai: [
    { url: GOOGLE("artificial intelligence OR ChatGPT OR Grok OR Claude OR OpenAI when:7d") },
    { url: "https://openai.com/blog/rss.xml", source: "OpenAI" },
    { url: "https://blog.google/technology/ai/rss/", source: "Google AI" },
    { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge" },
    { url: "https://arstechnica.com/ai/feed/", source: "Ars Technica" },
    { url: "https://huggingface.co/blog/feed.xml", source: "Hugging Face" },
  ],
  pictures: [
    { url: GOOGLE('AI image OR Midjourney OR "Stable Diffusion" OR Flux OR "AI art" OR "image model" when:14d') },
    { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge" },
    { url: "https://arstechnica.com/ai/feed/", source: "Ars Technica" },
    { url: "https://huggingface.co/blog/feed.xml", source: "Hugging Face" },
    { url: "https://www.reddit.com/r/StableDiffusion/.rss", source: "r/StableDiffusion" },
    { url: "https://www.reddit.com/r/midjourney/.rss", source: "r/midjourney" },
    { url: "https://www.reddit.com/r/aiArt/.rss", source: "r/aiArt" },
  ],
  videos: [
    { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", source: "Two Minute Papers" },
    { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew", source: "Yannic Kilcher" },
    { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw", source: "AI Explained" },
    { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChpleBmo18P08aKCIgti38g", source: "Matt Wolfe" },
    { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCHlNU7kIZhRgSbhHvFoy72w", source: "Hugging Face" },
  ],
};

export function feedsFor(topic: NewsTopic) {
  return FEEDS[topic];
}

export function decodeXml(raw: string) {
  const named = (name: string) => new RegExp("&" + name + ";", "g");
  let out = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&nbsp;/gi, " ")
      .replace(named("lt"), "<")
      .replace(named("gt"), ">")
      .replace(named("quot"), '"')
      .replace(named("apos"), "'")
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(named("amp"), "&");
  }
  return out;
}

function inner(xml: string, names: string[]) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
    const match = re.exec(xml);
    if (match) return decodeXml(match[1]).trim();
  }
  return "";
}

function attr(xml: string, tag: string, name: string) {
  const re = new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["'][^>]*/?>`, "i");
  const match = re.exec(xml);
  return match ? decodeXml(match[1]).trim() : "";
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksImage(url: string) {
  return (
    /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url) ||
    /ytimg|redditmedia|preview\.redd|i\.redd|external-preview|hf\.co|huggingface|googleusercontent|wp-content|cdn|imgur|pbs\.twimg/i.test(
      url,
    )
  );
}

function firstImage(xml: string, html: string, link: string) {
  const yt = youtubeId(link) || inner(xml, ["yt:videoId"]);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  const candidates = [
    attr(xml, "media:thumbnail", "url"),
    attr(xml, "media:content", "url"),
    attr(xml, "enclosure", "url"),
  ];
  for (const url of candidates) {
    if (url && looksImage(url)) return url;
  }
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (img?.[1] && !img[1].startsWith("data:")) return decodeXml(img[1]);
  return "";
}

export function youtubeId(link: string) {
  const m =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([A-Za-z0-9_-]{6,})/.exec(
      link,
    );
  return m?.[1] || "";
}

function hostName(link: string) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    if (host === "news.google.com") return "Google News";
    if (host === "youtube.com" || host === "youtu.be") return "YouTube";
    return host;
  } catch {
    return "News";
  }
}

function chunkByTag(xml: string, tag: string) {
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "gi");
  const close = `</${tag}>`;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = open.exec(xml))) {
    const start = match.index + match[0].length;
    const end = xml.toLowerCase().indexOf(close.toLowerCase(), start);
    if (end < 0) continue;
    out.push(xml.slice(start, end));
  }
  return out;
}

export function parseRss(xml: string, fallbackSource?: string): NewsItem[] {
  const blocks = [...chunkByTag(xml, "item"), ...chunkByTag(xml, "entry")];
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const title = inner(block, ["title"]);
    const link =
      inner(block, ["link"]) ||
      attr(block, "link", "href") ||
      inner(block, ["id", "guid"]);
    if (!title || !link) continue;
    const html = inner(block, ["description", "summary", "content:encoded", "content"]);
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    let excerpt = stripHtml(html).replace(/\s+/g, " ").trim().slice(0, 280);
    if (excerpt.toLowerCase() === cleanTitle.toLowerCase() || excerpt.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
      excerpt = excerpt.slice(cleanTitle.length).replace(/^[\s·\-–—]+/, "").trim();
    }
    if (excerpt.length < 40) excerpt = "";
    const published = inner(block, ["pubDate", "published", "updated", "dc:date"]);
    const publishedAt = Date.parse(published) || 0;
    const href = attr(block, "link", "href");
    const resolved = (href && href.startsWith("http") ? href : link).trim();
    if (!resolved.startsWith("http")) continue;
    const source = stripHtml(
      inner(block, ["source", "dc:creator"]) ||
        inner(block, ["name"]) ||
        fallbackSource ||
        hostName(resolved),
    );
    const yt = youtubeId(resolved) || inner(block, ["yt:videoId"]);
    const image =
      firstImage(block, html, resolved) ||
      (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : undefined);
    const video = Boolean(yt || /youtube|vimeo|\/watch\?v=/i.test(resolved));
    items.push({
      id: `${resolved}|${title}`,
      title: title.replace(/\s+/g, " ").trim(),
      link: resolved,
      source: source.replace(/\s+/g, " ").trim().slice(0, 48),
      publishedAt,
      excerpt,
      image,
      video,
    });
  }
  return items;
}

export function mergeNews(groups: NewsItem[][], topic: NewsTopic) {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = item.link.replace(/[?#].*$/, "") + "|" + item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  out.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  const filtered =
    topic === "pictures"
      ? out.filter((item) => Boolean(item.image))
      : topic === "videos"
        ? out.filter((item) => item.video || youtubeId(item.link))
        : out;
  return (filtered.length ? filtered : out).slice(0, 36);
}

export function relativeTime(ts: number) {
  if (!ts) return "";
  const delta = Date.now() - ts;
  const min = Math.round(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}
