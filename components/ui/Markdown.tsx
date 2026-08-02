import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/shared/cn";

export function Markdown({ children, tone = "light" }: { children: string; tone?: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <ReactMarkdown
      // singleTilde MUST stay false. GFM treats `~text~` as strikethrough, and
      // the agent writes `~` for "approximately" constantly ("~₹20,750/day",
      // "~120 g"). Two of those in one paragraph silently struck through
      // everything between them — including prices — which on a page about
      // auditable numbers reads as a correction the agent never made.
      // Genuine strikethrough still works with `~~double~~`.
      remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className={cn("font-semibold", isDark ? "text-white" : "text-ink-900")}>{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-1.5 mt-1 font-display text-base font-semibold first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-2 text-sm font-semibold uppercase tracking-wide text-ink-600 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
        code: ({ children }) => (
          <code
            className={cn(
              "rounded px-1 py-0.5 font-mono text-xs",
              isDark ? "bg-white/15 text-white" : "bg-ink-100 text-ink-800"
            )}
          >
            {children}
          </code>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        ),
        hr: () => <hr className={cn("my-2 border-dashed", isDark ? "border-white/30" : "border-ink-200")} />,
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className={cn("text-left", isDark ? "text-white/80" : "text-ink-500")}>{children}</thead>
        ),
        th: ({ children }) => (
          <th
            className={cn(
              "border-b px-2 py-1 font-semibold",
              isDark ? "border-white/30" : "border-ink-200"
            )}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className={cn("border-b px-2 py-1 align-top", isDark ? "border-white/15" : "border-ink-100")}>
            {children}
          </td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
