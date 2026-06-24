import { prisma } from "@/lib/prisma";
import { parseHoleArray } from "@/lib/holes";

export type TeeSetView = {
  id: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  par: number;
  yardages: number[] | null;
  totalYards: number | null;
};

export type CourseView = {
  id: string;
  name: string;
  location: string | null;
  par: number;
  holePars: number[];
  holeStrokeIndex: number[];
  teeSets: TeeSetView[];
  roundCount: number;
};

function toTeeSetView(t: {
  id: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  par: number;
  yardages: string | null;
}): TeeSetView {
  const yardages = t.yardages ? parseHoleArray(t.yardages) : null;
  return {
    id: t.id,
    name: t.name,
    courseRating: t.courseRating,
    slopeRating: t.slopeRating,
    par: t.par,
    yardages,
    totalYards: yardages ? yardages.reduce((a, b) => a + b, 0) : null,
  };
}

export async function getCourses(): Promise<CourseView[]> {
  const courses = await prisma.course.findMany({
    orderBy: { name: "asc" },
    include: {
      teeSets: { orderBy: { courseRating: "desc" } },
      _count: { select: { rounds: true } },
    },
  });
  return courses.map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    par: c.par,
    holePars: parseHoleArray(c.holePars),
    holeStrokeIndex: parseHoleArray(c.holeStrokeIndex),
    teeSets: c.teeSets.map(toTeeSetView),
    roundCount: c._count.rounds,
  }));
}

export async function getCourse(id: string): Promise<CourseView | null> {
  const c = await prisma.course.findUnique({
    where: { id },
    include: {
      teeSets: { orderBy: { courseRating: "desc" } },
      _count: { select: { rounds: true } },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    location: c.location,
    par: c.par,
    holePars: parseHoleArray(c.holePars),
    holeStrokeIndex: parseHoleArray(c.holeStrokeIndex),
    teeSets: c.teeSets.map(toTeeSetView),
    roundCount: c._count.rounds,
  };
}
