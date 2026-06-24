"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formOwnerKey, isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";
import {
  HOLE_COUNT,
  isValidStrokeIndex,
  serializeHoleArray,
} from "@/lib/holes";

const holeArray = (min: number, max: number) =>
  z
    .array(z.coerce.number().int().min(min).max(max))
    .length(HOLE_COUNT, `Must have exactly ${HOLE_COUNT} holes`);

const courseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  location: z.string().trim().optional().nullable(),
  holePars: holeArray(3, 6),
  holeStrokeIndex: holeArray(1, 18),
});

const teeSetSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  courseRating: z.coerce.number().min(50).max(85),
  slopeRating: z.coerce.number().int().min(55).max(155),
  par: z.coerce.number().int().min(60).max(80),
  yardages: holeArray(50, 800).optional(),
});

export type ActionState = { ok: boolean; error?: string };

function parseHoleFields(formData: FormData) {
  const pars: number[] = [];
  const si: number[] = [];
  for (let i = 0; i < HOLE_COUNT; i++) {
    pars.push(Number(formData.get(`par_${i}`)));
    si.push(Number(formData.get(`si_${i}`)));
  }
  return { pars, si };
}

export async function createCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    return { ok: false, error: ownerKeyError() };
  }
  const { pars, si } = parseHoleFields(formData);
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    holePars: pars,
    holeStrokeIndex: si,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isValidStrokeIndex(parsed.data.holeStrokeIndex)) {
    return { ok: false, error: "Stroke index must be a permutation of 1–18 (each used once)." };
  }

  const course = await prisma.course.create({
    data: {
      name: parsed.data.name,
      location: parsed.data.location || null,
      par: parsed.data.holePars.reduce((a, b) => a + b, 0),
      holePars: serializeHoleArray(parsed.data.holePars),
      holeStrokeIndex: serializeHoleArray(parsed.data.holeStrokeIndex),
    },
  });
  revalidatePath("/courses");
  redirect(`/courses/${course.id}`);
}

export async function updateCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    return { ok: false, error: ownerKeyError() };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing course id" };
  const { pars, si } = parseHoleFields(formData);
  const parsed = courseSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    holePars: pars,
    holeStrokeIndex: si,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isValidStrokeIndex(parsed.data.holeStrokeIndex)) {
    return { ok: false, error: "Stroke index must be a permutation of 1–18 (each used once)." };
  }

  await prisma.course.update({
    where: { id },
    data: {
      name: parsed.data.name,
      location: parsed.data.location || null,
      par: parsed.data.holePars.reduce((a, b) => a + b, 0),
      holePars: serializeHoleArray(parsed.data.holePars),
      holeStrokeIndex: serializeHoleArray(parsed.data.holeStrokeIndex),
    },
  });
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  return { ok: true };
}

export async function deleteCourse(formData: FormData): Promise<void> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    redirect(`/courses?error=${encodeURIComponent(ownerKeyError())}`);
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const roundCount = await prisma.round.count({ where: { courseId: id } });
  if (roundCount > 0) {
    // Don't orphan rounds; surface via redirect query.
    redirect(`/courses?error=${encodeURIComponent("Cannot delete a course that has rounds.")}`);
  }
  await prisma.course.delete({ where: { id } });
  revalidatePath("/courses");
  redirect("/courses");
}

export async function createTeeSet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return upsertTeeSet(formData, null);
}

export async function updateTeeSet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  return upsertTeeSet(formData, id || null);
}

async function upsertTeeSet(
  formData: FormData,
  id: string | null,
): Promise<ActionState> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    return { ok: false, error: ownerKeyError() };
  }
  const hasYardages = formData.get("yardages_0") != null;
  let yardages: number[] | undefined;
  if (hasYardages) {
    yardages = [];
    for (let i = 0; i < HOLE_COUNT; i++) {
      yardages.push(Number(formData.get(`yardages_${i}`)) || 0);
    }
  }
  const parsed = teeSetSchema.safeParse({
    courseId: formData.get("courseId"),
    name: formData.get("name"),
    courseRating: formData.get("courseRating"),
    slopeRating: formData.get("slopeRating"),
    par: formData.get("par"),
    yardages,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = {
    courseId: parsed.data.courseId,
    name: parsed.data.name,
    courseRating: parsed.data.courseRating,
    slopeRating: parsed.data.slopeRating,
    par: parsed.data.par,
    yardages: parsed.data.yardages
      ? serializeHoleArray(parsed.data.yardages)
      : null,
  };

  if (id) {
    await prisma.teeSet.update({ where: { id }, data });
  } else {
    await prisma.teeSet.create({ data });
  }
  revalidatePath(`/courses/${parsed.data.courseId}`);
  return { ok: true };
}

export async function deleteTeeSet(formData: FormData): Promise<void> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    const courseId = String(formData.get("courseId") ?? "");
    redirect(`/courses/${courseId}?error=${encodeURIComponent(ownerKeyError())}`);
  }
  const id = String(formData.get("id") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!id) return;
  const roundCount = await prisma.round.count({ where: { teeSetId: id } });
  if (roundCount > 0) {
    redirect(`/courses/${courseId}?error=${encodeURIComponent("Cannot delete a tee set that has rounds.")}`);
  }
  await prisma.teeSet.delete({ where: { id } });
  revalidatePath(`/courses/${courseId}`);
}
