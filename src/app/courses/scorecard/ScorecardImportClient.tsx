"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card } from "@/components/ui";
import { OwnerKeyField } from "@/components/OwnerKeyField";
import { FlagIcon, PlusIcon, TargetIcon } from "@/components/icons";
import { HOLE_COUNT } from "@/lib/holes";
import { extractScorecard, type ScorecardCourseState } from "./actions";

type ParsedScorecard = {
  name: string;
  location: string;
  teeName: string;
  courseRating: string;
  slopeRating: string;
  pars: number[];
  strokeIndex: number[];
  yardages: number[];
};

type Props = {
  action: (
    prev: ScorecardCourseState,
    formData: FormData,
  ) => Promise<ScorecardCourseState>;
};

const DEFAULT_PARS = Array(HOLE_COUNT).fill(4);
const DEFAULT_SI = Array.from({ length: HOLE_COUNT }, (_, i) => i + 1);
const DEFAULT_YARDS = Array(HOLE_COUNT).fill(350);

function emptyParsed(): ParsedScorecard {
  return {
    name: "",
    location: "",
    teeName: "",
    courseRating: "",
    slopeRating: "",
    pars: DEFAULT_PARS,
    strokeIndex: DEFAULT_SI,
    yardages: DEFAULT_YARDS,
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create course"}
    </Button>
  );
}

function numbersFromLine(line: string) {
  return [...line.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function rowAfterLabel(lines: string[], labels: RegExp[], min: number, max: number) {
  const candidates = lines
    .filter((line) => labels.some((label) => label.test(line)))
    .map((line) => numbersFromLine(line).filter((n) => n >= min && n <= max));
  for (const nums of candidates) {
    if (nums.length >= HOLE_COUNT) return nums.slice(0, HOLE_COUNT);
  }
  return null;
}

function findRatingSlope(text: string) {
  const slash = text.match(/(\d{2}\.\d)\s*\/\s*(\d{2,3})/);
  if (slash) return { rating: slash[1], slope: slash[2] };

  const rating = text.match(/(?:rating|cr)\D{0,8}(\d{2}\.\d)/i)?.[1] ?? "";
  const slope = text.match(/(?:slope|sr)\D{0,8}(\d{2,3})/i)?.[1] ?? "";
  return { rating, slope };
}

function likelyName(lines: string[]) {
  const noisy = /hole|yard|par|handicap|hcp|index|rating|slope|total|out|in/i;
  return lines.find((line) => line.length > 4 && !noisy.test(line) && !/\d{3,}/.test(line)) ?? "";
}

function parseScorecardText(text: string): ParsedScorecard {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const { rating, slope } = findRatingSlope(text);

  return {
    name: likelyName(lines),
    location: "",
    teeName: "",
    courseRating: rating,
    slopeRating: slope,
    pars:
      rowAfterLabel(lines, [/\bpar\b/i], 3, 6) ??
      DEFAULT_PARS,
    strokeIndex:
      rowAfterLabel(lines, [/\b(hcp|handicap|stroke|index|si)\b/i], 1, 18) ??
      DEFAULT_SI,
    yardages:
      rowAfterLabel(lines, [/\b(yards?|yds?|tees?|black|blue|white|gold|red)\b/i], 50, 800) ??
      DEFAULT_YARDS,
  };
}

function validStrokeIndex(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === HOLE_COUNT && sorted.every((value, i) => value === i + 1);
}

function NumberGrid({
  label,
  prefix,
  values,
  min,
  max,
  onChange,
}: {
  label: string;
  prefix: string;
  values: number[];
  min: number;
  max: number;
  onChange: (values: number[]) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="w-20 text-left font-medium">{label}</th>
            {Array.from({ length: HOLE_COUNT }, (_, i) => (
              <th key={i} className="font-medium">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="text-left text-xs font-medium text-muted">{label}</th>
            {values.map((value, i) => (
              <td key={i}>
                <input
                  name={`${prefix}_${i}`}
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => {
                    const next = [...values];
                    next[i] = Number(e.target.value);
                    onChange(next);
                  }}
                  className="w-14 rounded-md border border-border bg-background px-1 py-1 text-center tabular-nums"
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ScorecardImportClient({ action }: Props) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [parsed, setParsed] = useState<ParsedScorecard>(emptyParsed);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const totalPar = useMemo(
    () => parsed.pars.reduce((sum, value) => sum + (value || 0), 0),
    [parsed.pars],
  );
  const totalYards = useMemo(
    () => parsed.yardages.reduce((sum, value) => sum + (value || 0), 0),
    [parsed.yardages],
  );
  const siValid = useMemo(
    () => validStrokeIndex(parsed.strokeIndex),
    [parsed.strokeIndex],
  );

  async function onImage(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStatus("Reading scorecard with AI...");
    setProgress(0);
    setRunning(true);
    try {
      // Primary path: Gemini 2.5 Flash vision → structured fields.
      const fd = new FormData();
      fd.append("image", file);
      const res = await extractScorecard(fd);
      if (res.ok) {
        setRawText("");
        setParsed({
          name: res.data.name,
          location: res.data.location,
          teeName: res.data.teeName,
          courseRating: res.data.courseRating ? String(res.data.courseRating) : "",
          slopeRating: res.data.slopeRating ? String(res.data.slopeRating) : "",
          pars: res.data.pars,
          strokeIndex: res.data.strokeIndex,
          yardages: res.data.yardages,
        });
        setStatus("Extracted with AI — review the details before creating the course.");
        return;
      }

      // Fallback (e.g. no API key / offline): on-device OCR.
      setStatus(`AI unavailable (${res.error}). Falling back to OCR...`);
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(file, "eng", {
        logger: (message) => {
          if (message.status) setStatus(message.status);
          if (typeof message.progress === "number") setProgress(message.progress);
        },
      });
      const text = result.data.text;
      setRawText(text);
      setParsed(parseScorecardText(text));
      setStatus("Review the extracted details before creating the course.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read that image.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-3">
          <OwnerKeyField />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center transition hover:border-border-strong">
            <PlusIcon width={22} height={22} className="text-accent" />
            <span className="text-sm font-medium">Upload empty scorecard photo</span>
            <span className="text-xs text-muted">
              Use a clear, straight-on photo with the hole rows visible.
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onImage(e.target.files?.[0] ?? null)}
            />
          </label>
          {status && (
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <p>{running ? `${status} ${Math.round(progress * 100)}%` : status}</p>
              {running && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-56 overflow-hidden rounded-lg border border-border bg-background">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Uploaded scorecard"
              className="h-full max-h-[28rem] w-full object-contain"
            />
          ) : (
            <div className="grid h-full min-h-56 place-items-center text-sm text-muted">
              Preview appears here
            </div>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FlagIcon width={18} height={18} className="text-accent" />
          <h2 className="font-medium">Course details</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Course name</span>
            <input
              name="name"
              required
              value={parsed.name}
              onChange={(e) => setParsed((p) => ({ ...p, name: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Location</span>
            <input
              name="location"
              value={parsed.location}
              onChange={(e) => setParsed((p) => ({ ...p, location: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TargetIcon width={18} height={18} className="text-accent" />
          <h2 className="font-medium">Tee set</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Tee name</span>
            <input
              name="teeName"
              required
              value={parsed.teeName}
              placeholder="Blue"
              onChange={(e) => setParsed((p) => ({ ...p, teeName: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Course rating</span>
            <input
              name="courseRating"
              required
              type="number"
              step="0.1"
              value={parsed.courseRating}
              onChange={(e) =>
                setParsed((p) => ({ ...p, courseRating: e.target.value }))
              }
              className="rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Slope</span>
            <input
              name="slopeRating"
              required
              type="number"
              value={parsed.slopeRating}
              onChange={(e) =>
                setParsed((p) => ({ ...p, slopeRating: e.target.value }))
              }
              className="rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
            />
          </label>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Totals
            </p>
            <p className="mt-1 font-display text-lg font-medium tabular-nums">
              Par {totalPar} / {totalYards} yds
            </p>
            <p className={siValid ? "text-xs text-muted" : "text-xs text-red-600"}>
              SI {siValid ? "1-18 valid" : "must use 1-18 once"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <NumberGrid
          label="Par"
          prefix="par"
          values={parsed.pars}
          min={3}
          max={6}
          onChange={(pars) => setParsed((p) => ({ ...p, pars }))}
        />
        <NumberGrid
          label="SI"
          prefix="si"
          values={parsed.strokeIndex}
          min={1}
          max={18}
          onChange={(strokeIndex) => setParsed((p) => ({ ...p, strokeIndex }))}
        />
        <NumberGrid
          label="Yards"
          prefix="yardage"
          values={parsed.yardages}
          min={50}
          max={800}
          onChange={(yardages) => setParsed((p) => ({ ...p, yardages }))}
        />
      </Card>

      {rawText && (
        <details className="rounded-lg border border-border bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-medium">OCR text</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted">
            {rawText}
          </pre>
        </details>
      )}

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
