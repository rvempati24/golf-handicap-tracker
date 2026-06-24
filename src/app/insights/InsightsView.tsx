"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { WarningIcon } from "@/components/icons";
import { generateInsights, askQuestion } from "./actions";
import type { Insight, InsightReportView } from "./actions";

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InsightCard({ report }: { report: Extract<InsightReportView, { kind: "insight" }> }) {
  const i: Insight = report.insight;
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Coaching insight · {timeAgo(report.createdAt)} · {report.model}
        </p>
        <h3 className="mt-1 text-lg font-semibold">{i.headline}</h3>
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

function QuestionCard({ report }: { report: Extract<InsightReportView, { kind: "question" }> }) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted">
        Question · {timeAgo(report.createdAt)}
      </p>
      <p className="font-medium">{report.question}</p>
      <p className="whitespace-pre-wrap text-sm text-muted">{report.answer}</p>
    </Card>
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
  const [question, setQuestion] = useState("");
  const [genPending, startGen] = useTransition();
  const [askPending, startAsk] = useTransition();

  function onGenerate() {
    setError(null);
    startGen(async () => {
      const res = await generateInsights();
      if (!res.ok) setError(res.error);
      else setReports((prev) => [res.data, ...prev]);
    });
  }

  function onAsk() {
    setError(null);
    startAsk(async () => {
      const res = await askQuestion(question);
      if (!res.ok) setError(res.error);
      else {
        setReports((prev) => [res.data, ...prev]);
        setQuestion("");
      }
    });
  }

  const latestInsight = reports.find((r) => r.kind === "insight");
  const history = reports.filter((r) => r.id !== latestInsight?.id);

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onGenerate} disabled={genPending || !hasApiKey}>
          {genPending ? "Analyzing your game…" : "Generate fresh insights"}
        </Button>
        <span className="text-xs text-muted">
          Uses your stored rounds and stats. Each run is saved below.
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {latestInsight && latestInsight.kind === "insight" && (
        <InsightCard report={latestInsight} />
      )}

      {/* Ask about my game */}
      <Card className="flex flex-col gap-2">
        <h3 className="font-medium">Ask about my game</h3>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="e.g. Why am I scoring worse on par 5s? What should I practice to break 90?"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div>
          <Button
            onClick={onAsk}
            disabled={askPending || !hasApiKey || !question.trim()}
          >
            {askPending ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </Card>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted">History</h3>
          {history.map((r) =>
            r.kind === "insight" ? (
              <InsightCard key={r.id} report={r} />
            ) : (
              <QuestionCard key={r.id} report={r} />
            ),
          )}
        </section>
      )}
    </div>
  );
}
