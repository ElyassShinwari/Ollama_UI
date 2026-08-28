import { useEffect, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolvedTheme } from "@/lib/theme";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const locale = useChatStore((s) => s.settings.locale);
  return (
    <button
      type="button"
      className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] [@media(pointer:fine)]:after:hidden"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      aria-label={copied ? t(locale, "copied") : t(locale, "copyCode")}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const text = String(children).replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  const [html, setHtml] = useState<string | null>(null);
  const theme = useChatStore((s) => s.settings.theme);

  useEffect(() => {
    let cancelled = false;
    void import("highlight.js").then((mod) => {
      if (cancelled) return;
      const hljs = mod.default;
      try {
        const result = lang && hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang }) : hljs.highlightAuto(text);
        setHtml(result.value);
      } catch {
        setHtml(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  const dark = typeof document !== "undefined" && resolvedTheme(theme) === "dark";

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          {lang ?? "code"}
        </span>
        <CopyButton text={text} />
      </div>
      <pre className={cn("overflow-x-auto p-3 font-mono text-[13px] leading-relaxed", dark && "hljs-dark")}>
        {html ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{text}</code>}
      </pre>
    </div>
  );
}

export function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-hearth">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const safe =
              href && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:"));
            if (!safe) return <span>{children}</span>;
            return (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            );
          },
          img: () => null,
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className) || String(children).includes("\n");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code className={cn(className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

export function StreamingMarkdown({ content }: { content: string }) {
  const [shown, setShown] = useState(content);
  const lastRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    const grewNewline = content.lastIndexOf("\n") > shown.lastIndexOf("\n");
    if (grewNewline || now - lastRef.current >= 100) {
      lastRef.current = now;
      setShown(content);
      return;
    }
    const wait = Math.max(16, 100 - (now - lastRef.current));
    const id = window.setTimeout(() => {
      lastRef.current = Date.now();
      setShown(content);
    }, wait);
    return () => window.clearTimeout(id);
  }, [content, shown]);
  return (
    <div>
      <MessageMarkdown content={shown} />
      <span className="ms-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" aria-hidden="true" />
    </div>
  );
}
