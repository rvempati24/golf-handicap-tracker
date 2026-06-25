"use server";

import { Type, type Schema } from "@google/genai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRounds } from "@/lib/rounds";
import { getHandicapState } from "@/lib/handicap";
import {
  buildCoachingPayload,
  getGeminiClient,
  MissingApiKeyError,
  COACH_MODEL,
} from "@/lib/ai";
import { isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";
import { MIN_ROUNDS_TO_ESTABLISH } from "@/lib/whs";

export type Insight = {
  headline: string;
  weaknesses: { area: string; impactSummary: string; detail: string }[];
  improving: string[];
  practicePriorities: { title: string; detail: string }[];
  courseManagement: string[];
  scoringProjection: { target: string; rationale: string };
};

export type InsightReportView =
  | { id: string; kind: "insight"; createdAt: string; model: string; insight: Insight }
  | { id: string; kind: "question"; createdAt: string; model: string; question: string; answer: string };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Gemini structured-output schema (subset of OpenAPI). propertyOrdering keeps
// the model's output stable and readable.
const INSIGHT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    weaknesses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          impactSummary: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ["area", "impactSummary", "detail"],
        propertyOrdering: ["area", "impactSummary", "detail"],
      },
    },
    improving: { type: Type.ARRAY, items: { type: Type.STRING } },
    practicePriorities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
        },
        required: ["title", "detail"],
        propertyOrdering: ["title", "detail"],
      },
    },
    courseManagement: { type: Type.ARRAY, items: { type: Type.STRING } },
    scoringProjection: {
      type: Type.OBJECT,
      properties: {
        target: { type: Type.STRING },
        rationale: { type: Type.STRING },
      },
      required: ["target", "rationale"],
      propertyOrdering: ["target", "rationale"],
    },
  },
  required: [
    "headline",
    "weaknesses",
    "improving",
    "practicePriorities",
    "courseManagement",
    "scoringProjection",
  ],
  propertyOrdering: [
    "headline",
    "weaknesses",
    "improving",
    "practicePriorities",
    "courseManagement",
    "scoringProjection",
  ],
};

const COACH_SYSTEM = `You are an expert golf coach analyzing a single amateur golfer's performance data.
You will receive a JSON snapshot of their stats computed under the World Handicap System.
Ground every statement in the numbers provided — never invent stats the data doesn't contain.

When "shotLevelStrokesGained" is present, it is the strongest signal — prioritize it. It is
real per-shot strokes gained (Broadie PGA Tour baselines) broken down by category, by approach
distance bucket, by starting lie, by miss direction (the dial), and putting. Use it to pinpoint
exactly where strokes are lost (e.g. "you lose 1.9 SG/round on approaches from 175-200 and miss
right 64% of the time", "penalties cost X/round"). Reference specific distance buckets, lies, and
miss tendencies. perRoundVsTour compares to a tour pro; perRoundVsScratch compares to a scratch
amateur — cite whichever is more motivating/relevant. When shot-level data is absent, fall back to
the WHS stats and approximateStrokesGained.

Be specific and actionable. Rank weaknesses by their likely impact on scoring. Where a category is
null it means the golfer hasn't tracked it — don't treat null as zero. Keep each field concise and
free of fluff. Give 2-3 weaknesses.`;

function errorMessage(e: unknown): string {
  if (e instanceof MissingApiKeyError) return e.message;
  if (e && typeof e === "object" && "status" in e) {
    const status = (e as { status?: unknown }).status;
    const msg = (e as { message?: unknown }).message;
    return `Gemini API error${status ? ` (${String(status)})` : ""}: ${
      typeof msg === "string" ? msg : "request failed"
    }`;
  }
  return e instanceof Error ? e.message : "Something went wrong generating insights.";
}

export async function generateInsights(
  ownerKey: string,
): Promise<ActionResult<InsightReportView>> {
  if (!isOwnerKeyValid(ownerKey)) return { ok: false, error: ownerKeyError() };

  const [rounds, hcp] = await Promise.all([getRounds(), getHandicapState()]);
  if (rounds.length < MIN_ROUNDS_TO_ESTABLISH) {
    return {
      ok: false,
      error: `Log at least ${MIN_ROUNDS_TO_ESTABLISH} rounds before generating insights (you have ${rounds.length}).`,
    };
  }

  try {
    const ai = getGeminiClient();
    const payload = buildCoachingPayload(rounds, hcp);

    const response = await ai.models.generateContent({
      model: COACH_MODEL,
      contents: `Here is my golf data. Return the structured coaching analysis: my top 2-3 weaknesses ranked by scoring impact, what's improving, this week's practice priorities, course-management notes, and a realistic scoring projection.\n\n${JSON.stringify(payload, null, 2)}`,
      config: {
        systemInstruction: COACH_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: INSIGHT_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return { ok: false, error: "The model returned an empty response." };
    const insight = JSON.parse(text) as Insight;

    const saved = await prisma.insightReport.create({
      data: {
        kind: "insight",
        content: JSON.stringify(insight),
        model: response.modelVersion ?? COACH_MODEL,
      },
    });

    revalidatePath("/insights");
    revalidatePath("/");
    return {
      ok: true,
      data: {
        id: saved.id,
        kind: "insight",
        createdAt: saved.createdAt.toISOString(),
        model: saved.model,
        insight,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function clearChat(
  ownerKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isOwnerKeyValid(ownerKey)) return { ok: false, error: ownerKeyError() };
  await prisma.insightReport.deleteMany({ where: { kind: "question" } });
  revalidatePath("/insights");
  return { ok: true };
}

export async function askQuestion(
  question: string,
  ownerKey: string,
): Promise<ActionResult<InsightReportView>> {
  if (!isOwnerKeyValid(ownerKey)) return { ok: false, error: ownerKeyError() };

  const q = question.trim();
  if (!q) return { ok: false, error: "Please enter a question." };
  if (q.length > 500) return { ok: false, error: "Question is too long." };

  const [rounds, hcp] = await Promise.all([getRounds(), getHandicapState()]);
  if (rounds.length === 0) {
    return { ok: false, error: "Log a round first so there's data to answer from." };
  }

  try {
    const ai = getGeminiClient();
    const payload = buildCoachingPayload(rounds, hcp);

    const response = await ai.models.generateContent({
      model: COACH_MODEL,
      contents: `My data:\n${JSON.stringify(payload, null, 2)}\n\nQuestion: ${q}`,
      config: {
        systemInstruction: `${COACH_SYSTEM}\nAnswer the golfer's question directly and concisely using only their data. If the data can't answer it, say so plainly.`,
      },
    });

    const answer = response.text ?? "";
    if (!answer) return { ok: false, error: "The model returned an empty response." };

    const saved = await prisma.insightReport.create({
      data: {
        kind: "question",
        question: q,
        content: answer,
        model: response.modelVersion ?? COACH_MODEL,
      },
    });

    revalidatePath("/insights");
    return {
      ok: true,
      data: {
        id: saved.id,
        kind: "question",
        createdAt: saved.createdAt.toISOString(),
        model: saved.model,
        question: q,
        answer,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
