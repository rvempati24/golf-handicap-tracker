import { prisma } from "@/lib/prisma";

export type HoleResultView = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
  strokes: number;
  putts: number;
  girHit: boolean;
  fairwayHit: boolean | null;
  penalties: number;
  upDownAttempt: boolean;
  upDownSuccess: boolean;
  sandAttempt: boolean;
  sandSuccess: boolean;
  driveDistance: number | null;
};

export type RoundView = {
  id: string;
  datePlayed: Date;
  courseId: string;
  teeSetId: string;
  courseName: string;
  teeName: string;
  courseRating: number;
  slopeRating: number;
  teePar: number;
  pcc: number;
  notes: string | null;
  weather: string | null;
  totalStrokes: number | null;
  adjustedGrossScore: number | null;
  scoreDifferential: number | null;
  holes: HoleResultView[];
};

const roundInclude = {
  course: true,
  teeSet: true,
  holes: { orderBy: { holeNumber: "asc" as const } },
};

function toRoundView(r: {
  id: string;
  datePlayed: Date;
  courseId: string;
  teeSetId: string;
  pcc: number;
  notes: string | null;
  weather: string | null;
  totalStrokes: number | null;
  adjustedGrossScore: number | null;
  scoreDifferential: number | null;
  course: { name: string };
  teeSet: { name: string; courseRating: number; slopeRating: number; par: number };
  holes: HoleResultView[];
}): RoundView {
  return {
    id: r.id,
    datePlayed: r.datePlayed,
    courseId: r.courseId,
    teeSetId: r.teeSetId,
    courseName: r.course.name,
    teeName: r.teeSet.name,
    courseRating: r.teeSet.courseRating,
    slopeRating: r.teeSet.slopeRating,
    teePar: r.teeSet.par,
    pcc: r.pcc,
    notes: r.notes,
    weather: r.weather,
    totalStrokes: r.totalStrokes,
    adjustedGrossScore: r.adjustedGrossScore,
    scoreDifferential: r.scoreDifferential,
    holes: r.holes,
  };
}

export async function getRounds(): Promise<RoundView[]> {
  const rounds = await prisma.round.findMany({
    orderBy: { datePlayed: "desc" },
    include: roundInclude,
  });
  return rounds.map(toRoundView);
}

export async function getRound(id: string): Promise<RoundView | null> {
  const r = await prisma.round.findUnique({
    where: { id },
    include: roundInclude,
  });
  return r ? toRoundView(r) : null;
}
