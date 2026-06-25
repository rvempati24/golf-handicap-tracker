"use server";

import { Type, type Schema } from "@google/genai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRounds } from "@/lib/rounds";
import { getHandicapState } from "@/lib/handicap";
import { getInsightReports } from "@/lib/insights";
import {
  buildCoachingPayload,
  getGeminiClient,
  MissingApiKeyError,
  COACH_MODEL,
} from "@/lib/ai";
import { computeShotStrokesGained } from "@/lib/strokes-gained";
import { isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";
import { normalizeAiItems, type WeeklyPlan } from "@/lib/weekly-plan";

export type PlanResult = { ok: true; plan: WeeklyPlan } | { ok: false; error: string };

const PLAN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayIndex: { type: Type.NUMBER }, // 0 = Monday … 6 = Sunday
          text: { type: Type.STRING },
          category: { type: Type.STRING }, // approach | putting | aroundGreen | offTheTee | general
        },
        required: ["dayIndex", "text", "category"],
        propertyOrdering: ["dayIndex", "text", "category"],
      },
    },
  },
  required: ["items"],
};

const PLAN_SYSTEM = `You are a golf coach building a one-week practice plan for a single amateur.
You receive their strokes-gained profile (vs PGA Tour and scratch benchmarks), recent stats,
and the recent coaching conversation. Build a concrete Monday–Sunday plan as a list of items,
each tagged with dayIndex 0 (Monday) … 6 (Sunday).
Rules:
- Spend the most time on their weakest strokes-gained categories.
- 1–2 short, specific, checkable tasks per day (drills with reps/targets). Keep total realistic.
- Respect any constraints the golfer stated in the conversation (days available, no range access,
  injuries, equipment). If they said they can only practice certain days, only schedule those.
- Use category values: approach, putting, aroundGreen, offTheTee, general.
- Make tasks measurable ("10 balls", "make 30 in a row"), not vague.`;

export async function generateWeeklyPlan(
  weekStart: string,
  ownerKey: string,
): Promise<PlanResult> {
  if (!isOwnerKeyValid(ownerKey)) return { ok: false, error: ownerKeyError() };

  try {
    const [rounds, hcp, reports] = await Promise.all([
      getRounds(),
      getHandicapState(),
      getInsightReports(8),
    ]);
    if (rounds.length === 0) {
      return { ok: false, error: "Log a round first so the plan has something to work from." };
    }

    const payload = buildCoachingPayload(rounds, hcp);
    const sg = computeShotStrokesGained(rounds, "tour");
    const conversation = reports
      .map((r) =>
        r.kind === "question"
          ? `Q: ${r.question}\nA: ${r.answer}`
          : `Coaching headline: ${r.insight.headline}`,
      )
      .join("\n\n");

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: COACH_MODEL,
      contents: `Build my practice plan for the week starting Monday ${weekStart}.

My data:
${JSON.stringify(payload, null, 2)}

Shot-level strokes gained (vs PGA Tour):
${JSON.stringify(sg?.byCategory ?? "no shot-level data yet", null, 2)}

Recent coaching conversation (honor any constraints I mentioned):
${conversation || "(none yet)"}`,
      config: {
        systemInstruction: PLAN_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: PLAN_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return { ok: false, error: "The model returned an empty response." };
    const raw = JSON.parse(text) as {
      items: { dayIndex: number; text: string; category?: string }[];
    };
    const items = normalizeAiItems(weekStart, raw.items ?? []);
    if (items.length === 0) {
      return { ok: false, error: "The model didn't return any plan items — try again." };
    }
    const plan: WeeklyPlan = { weekStart, source: "ai", items };

    // One stored plan per week — replace any earlier one.
    await prisma.insightReport.deleteMany({ where: { kind: "plan", question: weekStart } });
    await prisma.insightReport.create({
      data: {
        kind: "plan",
        question: weekStart,
        content: JSON.stringify(plan),
        model: response.modelVersion ?? COACH_MODEL,
      },
    });

    revalidatePath("/plan");
    return { ok: true, plan };
  } catch (e) {
    if (e instanceof MissingApiKeyError) return { ok: false, error: e.message };
    const msg = e instanceof Error ? e.message : "Could not generate the plan.";
    return { ok: false, error: msg };
  }
}
