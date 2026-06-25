"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import { SparkIcon, PinIcon, ChevronDown, WarningIcon } from "@/components/icons";
import { generateInsights, askQuestion, clearChat } from "./actions";
import type { Insight, InsightReportView } from "./actions";

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const EXAMPLE_QUESTIONS = [
  "Why am I scoring worse on par 5s?",
  "What should I practice to break 90?",
  "Where am I losing the most strokes?",
  "Is my putting or approach play holding me back?",
];

function CoachAvatar() {
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
      <SparkIcon width={15} height={15} />
    </div>
  );
}

// The full structured analysis, rendered as a pinned summary card.
function InsightCard({
  report,
  pinned = false,
}: {
  report: Extract<InsightReportView, { kind: "insight" }>;
  pinned?: boolean;
}) {
  const i: Insight = report.insight;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
            {pinned && <PinIcon width={12} height={12} />}
            {pinned ? "Latest analysis" : "Coaching insight"} · {timeAgo(report.createdAt)}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{i.headline}</h3>
        </div>
      </div>

      <section>
        <h4 className="mb-1 text-sm font-medium text-muted">
          Top weaknesses (ranked by scoring impact)
        </h4>
        <ol className="flex flex-col gap-2">
          {i.weaknesses.map((w, idx) => (
            <li key={idx} className="rounded-lg bg-background p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {idx + 1}. {w.area}
                </span>
                <span className="text-xs text-muted">{w.impactSummary}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{w.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <h4 className="mb-1 text-sm font-medium text-muted">What&apos;s improving</h4>
          <ul className="list-disc pl-5 text-sm">
            {i.improving.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-1 text-sm font-medium text-muted">Course management</h4>
          <ul className="list-disc pl-5 text-sm">
            {i.courseManagement.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h4 className="mb-1 text-sm font-medium text-muted">This week&apos;s practice priorities</h4>
        <ul className="flex flex-col gap-2">
          {i.practicePriorities.map((p, idx) => (
            <li key={idx} className="rounded-lg border border-border p-3">
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted">{p.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-accent/10 p-3">
        <h4 className="text-sm font-medium">Scoring projection: {i.scoringProjection.target}</h4>
        <p className="text-sm text-muted">{i.scoringProjection.rationale}</p>
      </section>
    </Card>
  );
}

// One question + answer exchange in the chat thread.
function ChatExchange({
  report,
}: {
  report: Extract<InsightReportView, { kind: "question" }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-sm text-accent-fg">
          {report.question}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <CoachAvatar />
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface px-3.5 py-2">
          <p className="whitespace-pre-wrap text-sm">{report.answer}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
            {timeAgo(report.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InsightsView({
  initialReports,
  hasApiKey,
}: {
  initialReports: InsightReportView[];
  hasApiKey: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [error, setError] = useState<string | null>(null);
  const { ownerKey, setOwnerKey } = useOwnerKey();
  const [question, setQuestion] = useState("");
  const [genPending, startGen] = useTransition();
  const [askPending, startAsk] = useTransition();
  const [clearPending, startClear] = useTransition();
  const [showEarlier, setShowEarlier] = useState(false);

  function onGenerate() {
    setError(null);
    startGen(async () => {
      const res = await generateInsights(ownerKey);
      if (!res.ok) setError(res.error);
      else setReports((prev) => [res.data, ...prev]);
    });
  }

  function onAsk() {
    if (!question.trim()) return;
    setError(null);
    startAsk(async () => {
      const res = await askQuestion(question, ownerKey);
      if (!res.ok) setError(res.error);
      else {
        setReports((prev) => [res.data, ...prev]);
        setQuestion("");
      }
    });
  }

  function onClearChat() {
    if (!window.confirm("Clear the conversation? This can't be undone.")) return;
    setError(null);
    startClear(async () => {
      const res = await clearChat(ownerKey);
      if (!res.ok) setError(res.error ?? "Couldn't clear the chat.");
      else setReports((prev) => prev.filter((r) => r.kind !== "question"));
    });
  }

  const insights = reports.filter(
    (r): r is Extract<InsightReportView, { kind: "insight" }> => r.kind === "insight",
  );
  const latestInsight = insights[0];
  const earlierInsights = insights.slice(1);
  // Question/answer exchanges, oldest first so the newest sits by the composer.
  const thread = reports
    .filter((r): r is Extract<InsightReportView, { kind: "question" }> => r.kind === "question")
    .reverse();

  const canSend = hasApiKey && Boolean(ownerKey.trim());
  const busy = genPending || askPending;

  return (
    <div className="flex flex-col gap-4">
      {!hasApiKey && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex gap-3 text-sm text-amber-800 dark:text-amber-200">
            <WarningIcon width={18} height={18} className="mt-0.5 shrink-0" />
            <p>
              <strong>GEMINI_API_KEY is not set.</strong> Add it to your{" "}
              <code>.env</code> and restart the dev server to enable AI insights.
              Get a free key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                aistudio.google.com/apikey
              </a>
              .
            </p>
          </div>
        </Card>
      )}

      {/* Pinned latest full analysis */}
      {latestInsight && <InsightCard report={latestInsight} pinned />}

      {earlierInsights.length > 0 && (
        <details
          open={showEarlier}
          onToggle={(e) => setShowEarlier((e.target as HTMLDetailsElement).open)}
          className="flex flex-col gap-3"
        >
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted">
            <ChevronDown
              width={14}
              height={14}
              className={`transition-transform ${showEarlier ? "" : "-rotate-90"}`}
            />
            {earlierInsights.length} earlier{" "}
            {earlierInsights.length === 1 ? "analysis" : "analyses"}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {earlierInsights.map((r) => (
              <InsightCard key={r.id} report={r} />
            ))}
          </div>
        </details>
      )}

      {/* Conversation thread */}
      {thread.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted">
              Conversation
            </span>
            <button
              type="button"
              onClick={onClearChat}
              disabled={clearPending || !ownerKey.trim()}
              className="text-xs text-muted transition hover:text-red-600 disabled:opacity-50"
            >
              {clearPending ? "Clearing…" : "Clear chat"}
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {thread.map((r) => (
              <ChatExchange key={r.id} report={r} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <CoachAvatar />
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-surface px-3.5 py-3">
            <p className="text-sm">
              I&apos;m your AI golf coach. Ask me anything about your game, or
              generate a full analysis grounded in your rounds and stats.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composer — sits above the thread with a blurred fade so bubbles
          scrolling underneath dissolve into it instead of hard-overlapping. */}
      <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-background from-60% via-background/80 to-transparent px-1 pb-3 pt-8 backdrop-blur-sm">
        <Card className="flex flex-col gap-2.5">
          {!ownerKey.trim() && (
            <div className="max-w-xs">
              <OwnerKeyField value={ownerKey} onValueChange={setOwnerKey} />
              <p className="mt-1 text-xs text-muted">
                Required so only you can spend the AI quota.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend && !busy) onAsk();
                }
              }}
              rows={1}
              placeholder={
                canSend ? "Ask about your game…" : "Enter your owner key to chat…"
              }
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <Button
              onClick={onAsk}
              disabled={busy || !canSend || !question.trim()}
              className="h-10 w-10 !px-0"
              aria-label="Send"
            >
              {askPending ? "…" : <SparkIcon width={16} height={16} />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={onGenerate}
              disabled={busy || !canSend}
              className="text-sm"
            >
              {genPending ? "Analyzing your game…" : "Generate full insights"}
            </Button>
            <span className="text-xs text-muted">
              Grounded in your rounds and stats. Each reply is saved.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
