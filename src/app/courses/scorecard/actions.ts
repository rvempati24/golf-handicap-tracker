"use server";

import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  HOLE_COUNT,
  isValidStrokeIndex,
  serializeHoleArray,
} from "@/lib/holes";
import { formOwnerKey, isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";
import { getGeminiClient, MissingApiKeyError } from "@/lib/ai";

export type ScorecardCourseState = { ok: boolean; error?: string };

// ── Scorecard photo → structured data via Gemini 2.5 Flash (vision) ──────────
export type ExtractedScorecard = {
  name: string;
  location: string;
  teeName: string;
  courseRating: number;
  slopeRating: number;
  pars: number[];
  strokeIndex: number[];
  yardages: number[];
};

export type ExtractResult =
  | { ok: true; data: ExtractedScorecard }
  | { ok: false; error: string };

const SCORECARD_MODEL = "gemini-2.5-flash";

const numberArray18: Schema = { type: Type.ARRAY, items: { type: Type.NUMBER } };

const SCORECARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    location: { type: Type.STRING },
    teeName: { type: Type.STRING },
    courseRating: { type: Type.NUMBER },
    slopeRating: { type: Type.NUMBER },
    pars: numberArray18,
    strokeIndex: numberArray18,
    yardages: numberArray18,
  },
  required: [
    "name", "location", "teeName", "courseRating",
    "slopeRating", "pars", "strokeIndex", "yardages",
  ],
};

const SCORECARD_PROMPT = `You are reading a photo of a golf scorecard. Extract the course details and per-hole data.
Return JSON with:
- name: the golf course name
- location: city and state/country if visible, otherwise ""
- teeName: the tee set (color/name) the yardages belong to; if several, pick the most prominent set
- courseRating: the Course Rating for that tee (e.g. 72.9)
- slopeRating: the Slope Rating for that tee (e.g. 140)
- pars: array of exactly 18 par values, holes 1..18
- strokeIndex: array of exactly 18 handicap/stroke-index values, holes 1..18
- yardages: array of exactly 18 yardages, holes 1..18
Scorecards usually split front 9 and back 9 — concatenate them into 18 values in hole order.
Ignore OUT / IN / TOTAL columns. If a single value is unreadable, give your best estimate; never return fewer than 18 entries.`;

function fit18(arr: unknown, fallback: number): number[] {
  const nums = Array.isArray(arr) ? arr.map((v) => Number(v)) : [];
  return Array.from({ length: HOLE_COUNT }, (_, i) =>
    Number.isFinite(nums[i]) ? Math.round(nums[i]) : fallback,
  );
}

export async function extractScorecard(formData: FormData): Promise<ExtractResult> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    return { ok: false, error: ownerKeyError() };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a scorecard photo." };
  }
  if (file.size > 12 * 1024 * 1024) {
    return { ok: false, error: "Image is too large (max 12MB)." };
  }

  try {
    const ai = getGeminiClient();
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const res = await ai.models.generateContent({
      model: SCORECARD_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: file.type || "image/jpeg", data: base64 } },
            { text: SCORECARD_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: SCORECARD_SCHEMA,
      },
    });

    const text = res.text;
    if (!text) return { ok: false, error: "The model returned an empty response." };
    const raw = JSON.parse(text) as Partial<ExtractedScorecard>;

    return {
      ok: true,
      data: {
        name: String(raw.name ?? "").trim(),
        location: String(raw.location ?? "").trim(),
        teeName: String(raw.teeName ?? "").trim(),
        courseRating: Number(raw.courseRating) || 0,
        slopeRating: Math.round(Number(raw.slopeRating) || 0),
        pars: fit18(raw.pars, 4),
        strokeIndex: fit18(raw.strokeIndex, 0),
        yardages: fit18(raw.yardages, 0),
      },
    };
  } catch (e) {
    if (e instanceof MissingApiKeyError) return { ok: false, error: e.message };
    const msg = e instanceof Error ? e.message : "Could not read that scorecard.";
    return { ok: false, error: msg };
  }
}

const holeArray = (min: number, max: number) =>
  z
    .array(z.coerce.number().int().min(min).max(max))
    .length(HOLE_COUNT, `Must have exactly ${HOLE_COUNT} holes`);

const scorecardCourseSchema = z.object({
  name: z.string().trim().min(1, "Course name is required"),
  location: z.string().trim().optional().nullable(),
  teeName: z.string().trim().min(1, "Tee name is required"),
  courseRating: z.coerce.number().min(50).max(85),
  slopeRating: z.coerce.number().int().min(55).max(155),
  holePars: holeArray(3, 6),
  holeStrokeIndex: holeArray(1, 18),
  yardages: holeArray(50, 800),
});

function readHoleNumbers(formData: FormData, prefix: string) {
  return Array.from({ length: HOLE_COUNT }, (_, i) =>
    Number(formData.get(`${prefix}_${i}`)),
  );
}

export async function createCourseFromScorecard(
  _prev: ScorecardCourseState,
  formData: FormData,
): Promise<ScorecardCourseState> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    return { ok: false, error: ownerKeyError() };
  }

  const parsed = scorecardCourseSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    teeName: formData.get("teeName"),
    courseRating: formData.get("courseRating"),
    slopeRating: formData.get("slopeRating"),
    holePars: readHoleNumbers(formData, "par"),
    holeStrokeIndex: readHoleNumbers(formData, "si"),
    yardages: readHoleNumbers(formData, "yardage"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isValidStrokeIndex(parsed.data.holeStrokeIndex)) {
    return {
      ok: false,
      error: "Stroke index must use every number from 1 to 18 exactly once.",
    };
  }

  const par = parsed.data.holePars.reduce((sum, holePar) => sum + holePar, 0);
  const course = await prisma.course.create({
    data: {
      name: parsed.data.name,
      location: parsed.data.location || null,
      par,
      holePars: serializeHoleArray(parsed.data.holePars),
      holeStrokeIndex: serializeHoleArray(parsed.data.holeStrokeIndex),
      teeSets: {
        create: {
          name: parsed.data.teeName,
          courseRating: parsed.data.courseRating,
          slopeRating: parsed.data.slopeRating,
          par,
          yardages: serializeHoleArray(parsed.data.yardages),
        },
      },
    },
  });

  revalidatePath("/courses");
  redirect(`/courses/${course.id}`);
}
