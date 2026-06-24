"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeHoleArray } from "@/lib/holes";
import {
  searchGolfCourses,
  type ImportableCourse,
} from "@/lib/golf-course-api";
import { isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";

export type CourseImportResult =
  | { ok: true; courses: ImportableCourse[] }
  | { ok: false; error: string };

export type ImportSaveResult =
  | { ok: true; courseId: string; message: string }
  | { ok: false; error: string };

const searchSchema = z.object({
  ownerKey: z.string().optional(),
  query: z.string().trim().min(2, "Search for at least 2 characters."),
});

const importSchema = z.object({
  ownerKey: z.string().optional(),
  course: z.custom<ImportableCourse>(),
  gender: z.enum(["male", "female"]),
  teeIndex: z.number().int().min(0),
});

function actionError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function searchCourseImport(
  input: z.input<typeof searchSchema>,
): Promise<CourseImportResult> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }
  if (!isOwnerKeyValid(parsed.data.ownerKey)) {
    return { ok: false, error: ownerKeyError() };
  }

  try {
    const courses = await searchGolfCourses(parsed.data.query);
    return { ok: true, courses };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function importCourseFromApi(
  input: z.input<typeof importSchema>,
): Promise<ImportSaveResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid import." };
  }
  if (!isOwnerKeyValid(parsed.data.ownerKey)) {
    return { ok: false, error: ownerKeyError() };
  }

  try {
    const course = parsed.data.course;
    if (!course?.id || !course.name || !Array.isArray(course.tees)) {
      return { ok: false, error: "Course not found." };
    }

    const tee = course.tees.find(
      (t) =>
        t.gender === parsed.data.gender && t.teeIndex === parsed.data.teeIndex,
    );
    if (!tee) return { ok: false, error: "Selected tee was not found." };
    if (!tee.importable || tee.courseRating == null || tee.slopeRating == null) {
      return {
        ok: false,
        error: "That tee is missing rating, slope, or complete 18-hole data.",
      };
    }

    const holePars = tee.holes.map((h) => h.par);
    const holeStrokeIndex = tee.holes.map((h) => h.handicap);
    const yardages = tee.holes.map((h) => h.yardage ?? 0);
    const par = tee.par ?? holePars.reduce((sum, h) => sum + h, 0);

    const existingCourse = await prisma.course.findFirst({
      where: {
        name: course.name,
        location: course.location,
      },
      include: { teeSets: true },
    });

    const dbCourse =
      existingCourse ??
      (await prisma.course.create({
        data: {
          name: course.name,
          location: course.location,
          par,
          holePars: serializeHoleArray(holePars),
          holeStrokeIndex: serializeHoleArray(holeStrokeIndex),
        },
        include: { teeSets: true },
      }));

    const existingTee = dbCourse.teeSets.find(
      (t) =>
        t.name === tee.teeName &&
        t.courseRating === tee.courseRating &&
        t.slopeRating === tee.slopeRating,
    );
    if (existingTee) {
      return {
        ok: true,
        courseId: dbCourse.id,
        message: `${course.name} already has the ${tee.teeName} tee set.`,
      };
    }

    await prisma.teeSet.create({
      data: {
        courseId: dbCourse.id,
        name: tee.teeName,
        courseRating: tee.courseRating,
        slopeRating: tee.slopeRating,
        par,
        yardages: serializeHoleArray(yardages),
      },
    });

    revalidatePath("/courses");
    revalidatePath(`/courses/${dbCourse.id}`);

    return {
      ok: true,
      courseId: dbCourse.id,
      message: `Imported ${course.name} - ${tee.teeName}.`,
    };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
