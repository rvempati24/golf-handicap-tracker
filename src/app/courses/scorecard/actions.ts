"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  HOLE_COUNT,
  isValidStrokeIndex,
  serializeHoleArray,
} from "@/lib/holes";
import { formOwnerKey, isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";

export type ScorecardCourseState = { ok: boolean; error?: string };

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
