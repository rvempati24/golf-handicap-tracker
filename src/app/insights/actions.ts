"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRounds } from "@/lib/rounds";
import { getHandicapState } from "@/lib/handicap";
import {
  buildCoachingPayload,
  getAnthropicClient,
  textFromMessage,
  MissingApiKeyError,
  COACH_MODEL,
} from "@/lib/ai";
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

const INSIGHT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    weaknesses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          impactSummary: { type: "string" },
          detail: { type: "string" },
        },
        required: ["area", "impactSummary", "detail"],
      },
    },
    improving: { type: "array", items: { type: "string" } },
    practicePriorities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
    courseManagement: { type: "array", items: { type: "string" } },
    scoringProjection: {
      type: "object",
      additionalProperties: false,
      properties: {
        target: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["target", "rationale"],
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
} as const;

const COACH_SYSTEM = `You are an expert golf coach analyzing a single amateur golfer's performance data.
You will receive a JSON snapshot of their stats computed under the World Handicap System.
Ground every statement in the numbers provided — never invent stats the data doesn't contain.
Be specific and actionable. Rank weaknesses by their likely impact on scoring (a high
doubles-or-worse rate or poor scrambling usually costs more than a fractional GIR difference).
Where a category is null it means the golfer hasn't tracked it — don't treat null as zero.
Keep each field concise and free of fluff.`;

function errorMessage(e: unknown): string {
  if (e instanceof MissingApiKeyError) return e.message;
  if (e instanceof Anthropic.APIError) {
    return `Anthropic API error (${e.status ?? "?"}): ${e.message}`;
  }
  return e instanceof Error ? e.message : "Something went wrong generating insights.";
}

export async function generateInsights(): Promise<ActionResult<InsightReportView>> {
  const [rounds, hcp] = await Promise.all([getRounds(), getHandicapState()]);
  if (rounds.length < MIN_ROUNDS_TO_ESTABLISH) {
    return {
      ok: false,
      error: `Log at least ${MIN_ROUNDS_TO_ESTABLISH} rounds before generating insights (you have ${rounds.length}).`,
    };
  }

  try {
    const client = getAnthropicClient();
    const payload = buildCoachingPayload(rounds, hcp);

    const message = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          name: "golf_insight",
          schema: INSIGHT_JSON_SCHEMA,
        },
      },
      system: COACH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is my golf data. Return the structured coaching analysis: include my top 2-3 weaknesses ranked by scoring impact, what's improving, this week's practice priorities, course-management notes, and a realistic scoring projection.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    } as Anthropic.Messages.MessageCreateParamsNonStreaming);

    const text = textFromMessage(message.content);
    const insight = JSON.parse(text) as Insight;

    const saved = await prisma.insightReport.create({
      data: {
        kind: "insight",
        content: JSON.stringify(insight),
        model: message.model,
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

export async function askQuestion(
  question: string,
): Promise<ActionResult<InsightReportView>> {
  const q = question.trim();
  if (!q) return { ok: false, error: "Please enter a question." };
  if (q.length > 500) return { ok: false, error: "Question is too long." };

  const [rounds, hcp] = await Promise.all([getRounds(), getHandicapState()]);
  if (rounds.length === 0) {
    return { ok: false, error: "Log a round first so there's data to answer from." };
  }

  try {
    const client = getAnthropicClient();
    const payload = buildCoachingPayload(rounds, hcp);

    const message = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: `${COACH_SYSTEM}\nAnswer the golfer's question directly and concisely using only their data below. If the data can't answer it, say so plainly.`,
      messages: [
        {
          role: "user",
          content: `My data:\n${JSON.stringify(payload, null, 2)}\n\nQuestion: ${q}`,
        },
      ],
    } as Anthropic.Messages.MessageCreateParamsNonStreaming);

    const answer = textFromMessage(message.content);
    const saved = await prisma.insightReport.create({
      data: {
        kind: "question",
        question: q,
        content: answer,
        model: message.model,
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
