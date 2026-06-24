"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deriveGir } from "@/lib/scoring";
import { recomputeHandicap } from "@/lib/handicap";
import { formOwnerKey, isOwnerKeyValid, ownerKeyError } from "@/lib/owner-key";

const holeInputSchema = z
  .object({
    holeNumber: z.number().int().min(1).max(18),
    par: z.number().int().min(3).max(6),
    strokeIndex: z.number().int().min(1).max(18),
    strokes: z.number().int().min(1).max(20),
    putts: z.number().int().min(0).max(12),
    fairwayHit: z.boolean().nullable(),
    girOverride: z.boolean().nullable().optional(),
    penalties: z.number().int().min(0).max(10),
    upDownAttempt: z.boolean(),
    upDownSuccess: z.boolean(),
    sandAttempt: z.boolean(),
    sandSuccess: z.boolean(),
    driveDistance: z.number().int().min(0).max(450).nullable(),
  })
  .refine((h) => h.putts <= h.strokes, {
    message: "Putts cannot exceed strokes",
    path: ["putts"],
  })
  .refine((h) => !(h.upDownSuccess && !h.upDownAttempt), {
    message: "Up-and-down success requires an attempt",
    path: ["upDownSuccess"],
  })
  .refine((h) => !(h.sandSuccess && !h.sandAttempt), {
    message: "Sand save success requires an attempt",
    path: ["sandSuccess"],
  });

const shotInputSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  shotNumber: z.number().int().min(1).max(20),
  club: z.string().trim().max(40).optional().nullable(),
  shotType: z.enum(["tee", "approach", "short_game", "bunker", "putt", "penalty"]),
  startDistanceYards: z.number().int().min(0).max(700).optional().nullable(),
  endDistanceYards: z.number().int().min(0).max(700).optional().nullable(),
  startLie: z.string().trim().max(40).optional().nullable(),
  endLie: z.string().trim().max(40).optional().nullable(),
  result: z.string().trim().max(40).optional().nullable(),
  penalty: z.boolean().default(false),
});

const roundInputSchema = z.object({
  ownerKey: z.string().optional(),
  datePlayed: z.string().min(1),
  courseId: z.string().min(1, "Pick a course"),
  teeSetId: z.string().min(1, "Pick a tee set"),
  pcc: z.number().int().min(-1).max(3).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  weather: z.string().trim().max(200).optional().nullable(),
  holes: z.array(holeInputSchema).length(18, "All 18 holes are required"),
  shots: z.array(shotInputSchema).optional(),
});

export type RoundInput = z.input<typeof roundInputSchema>;
export type RoundResult = { ok: boolean; error?: string; id?: string };

function buildHoleData(holes: z.infer<typeof roundInputSchema>["holes"]) {
  return holes.map((h) => {
    const isPar3 = h.par === 3;
    const gir =
      h.girOverride != null ? h.girOverride : deriveGir(h.strokes, h.putts, h.par);
    return {
      holeNumber: h.holeNumber,
      par: h.par,
      strokeIndex: h.strokeIndex,
      strokes: h.strokes,
      putts: h.putts,
      girHit: gir,
      // Fairway is meaningless on par 3s.
      fairwayHit: isPar3 ? null : h.fairwayHit,
      penalties: h.penalties,
      upDownAttempt: h.upDownAttempt,
      upDownSuccess: h.upDownSuccess,
      sandAttempt: h.sandAttempt,
      sandSuccess: h.sandSuccess,
      driveDistance: h.driveDistance,
    };
  });
}

function buildShotData(shots: z.infer<typeof roundInputSchema>["shots"]) {
  return (shots ?? []).map((s) => ({
    holeNumber: s.holeNumber,
    shotNumber: s.shotNumber,
    club: s.club || null,
    shotType: s.shotType,
    startDistanceYards: s.startDistanceYards ?? null,
    endDistanceYards: s.endDistanceYards ?? null,
    startLie: s.startLie || null,
    endLie: s.endLie || null,
    result: s.result || null,
    penalty: s.penalty,
  }));
}

export async function createRound(input: RoundInput): Promise<RoundResult> {
  const parsed = roundInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isOwnerKeyValid(parsed.data.ownerKey)) {
    return { ok: false, error: ownerKeyError() };
  }
  const data = parsed.data;

  // Verify the tee set belongs to the course.
  const teeSet = await prisma.teeSet.findUnique({ where: { id: data.teeSetId } });
  if (!teeSet || teeSet.courseId !== data.courseId) {
    return { ok: false, error: "Selected tee set does not belong to that course." };
  }

  const holeData = buildHoleData(data.holes);
  const shotData = buildShotData(data.shots);
  const totalStrokes = holeData.reduce((sum, h) => sum + h.strokes, 0);

  const round = await prisma.round.create({
    data: {
      datePlayed: new Date(data.datePlayed),
      courseId: data.courseId,
      teeSetId: data.teeSetId,
      pcc: data.pcc ?? 0,
      notes: data.notes || null,
      weather: data.weather || null,
      totalStrokes,
      holes: { create: holeData },
      shots: shotData.length ? { create: shotData } : undefined,
    },
  });

  await recomputeHandicap();
  revalidatePath("/rounds");
  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, id: round.id };
}

export async function updateRound(
  id: string,
  input: RoundInput,
): Promise<RoundResult> {
  const parsed = roundInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isOwnerKeyValid(parsed.data.ownerKey)) {
    return { ok: false, error: ownerKeyError() };
  }
  const data = parsed.data;

  const teeSet = await prisma.teeSet.findUnique({ where: { id: data.teeSetId } });
  if (!teeSet || teeSet.courseId !== data.courseId) {
    return { ok: false, error: "Selected tee set does not belong to that course." };
  }

  const holeData = buildHoleData(data.holes);
  const shotData = buildShotData(data.shots);
  const totalStrokes = holeData.reduce((sum, h) => sum + h.strokes, 0);

  await prisma.$transaction([
    prisma.shot.deleteMany({ where: { roundId: id } }),
    prisma.holeResult.deleteMany({ where: { roundId: id } }),
    prisma.round.update({
      where: { id },
      data: {
        datePlayed: new Date(data.datePlayed),
        courseId: data.courseId,
        teeSetId: data.teeSetId,
        pcc: data.pcc ?? 0,
        notes: data.notes || null,
        weather: data.weather || null,
        totalStrokes,
        holes: { create: holeData },
        shots: shotData.length ? { create: shotData } : undefined,
      },
    }),
  ]);

  await recomputeHandicap();
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${id}`);
  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, id };
}

export async function deleteRound(formData: FormData): Promise<void> {
  if (!isOwnerKeyValid(formOwnerKey(formData))) {
    redirect(`/rounds?error=${encodeURIComponent(ownerKeyError())}`);
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.round.delete({ where: { id } });
  await recomputeHandicap();
  revalidatePath("/rounds");
  revalidatePath("/");
  revalidatePath("/stats");
  redirect("/rounds");
}
