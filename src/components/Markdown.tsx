import type { ReactNode } from "react";

// A deliberately tiny, safe Markdown renderer for AI replies. It builds React
// nodes (no HTML injection) and supports the subset models actually emit:
// **bold**, *italic*, `code`, bullet and numbered lists, and paragraphs.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] != null) nodes.push(<strong key={key}>{m[1]}</strong>);
    else if (m[2] != null) nodes.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={key}>{m[3]}</em>);
    else if (m[4] != null)
      nodes.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
          {m[4]}
        </code>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let blockKey = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, idx) => (
      <li key={idx}>{renderInline(it, `li-${blockKey}-${idx}`)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`b-${blockKey++}`} className="list-decimal pl-5">
          {items}
        </ol>
      ) : (
        <ul key={`b-${blockKey++}`} className="list-disc pl-5">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)/.exec(line);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`b-${blockKey++}`}>{renderInline(line, `p-${blockKey}`)}</p>,
      );
    }
  }
  flushList();

  return <div className={`flex flex-col gap-2 ${className}`}>{blocks}</div>;
}
