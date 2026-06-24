import { HOLE_COUNT } from "@/lib/holes";

const API_BASE = "https://api.golfcourseapi.com";

type ApiHole = {
  par?: number;
  yardage?: number;
  handicap?: number;
};

type ApiTeeBox = {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  total_yards?: number;
  number_of_holes?: number;
  par_total?: number;
  holes?: ApiHole[];
};

type ApiCourse = {
  id?: number;
  club_name?: string;
  course_name?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  tees?: {
    female?: ApiTeeBox[];
    male?: ApiTeeBox[];
  };
};

type SearchResponse = {
  courses?: ApiCourse[];
};

export type ImportableTee = {
  gender: "male" | "female";
  teeName: string;
  courseRating: number | null;
  slopeRating: number | null;
  par: number | null;
  totalYards: number | null;
  holes: {
    par: number;
    yardage: number | null;
    handicap: number;
  }[];
  importable: boolean;
};

export type ImportableCourse = {
  id: number;
  name: string;
  clubName: string;
  courseName: string;
  location: string | null;
  tees: ImportableTee[];
};

function apiKey(): string {
  const key = process.env.GOLF_COURSE_API_KEY?.trim();
  if (!key) {
    throw new Error("GOLF_COURSE_API_KEY is not set.");
  }
  return key;
}

function courseName(course: ApiCourse): string {
  const club = course.club_name?.trim() ?? "";
  const courseName = course.course_name?.trim() ?? "";
  if (club && courseName && club !== courseName) return `${club} - ${courseName}`;
  return club || courseName || "Unnamed course";
}

function locationLabel(course: ApiCourse): string | null {
  const loc = course.location;
  if (!loc) return null;
  const parts = [loc.city, loc.state, loc.country].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return loc.address?.trim() || null;
}

function normalizeTee(tee: ApiTeeBox, gender: "male" | "female"): ImportableTee {
  const holes = Array.isArray(tee.holes)
    ? tee.holes.map((h) => ({
        par: Number(h.par) || 0,
        yardage: Number.isFinite(h.yardage) ? Number(h.yardage) : null,
        handicap: Number(h.handicap) || 0,
      }))
    : [];
  const importable =
    holes.length === HOLE_COUNT &&
    holes.every((h) => h.par >= 3 && h.par <= 6 && h.handicap >= 1 && h.handicap <= 18) &&
    new Set(holes.map((h) => h.handicap)).size === HOLE_COUNT &&
    Number.isFinite(tee.course_rating) &&
    Number.isFinite(tee.slope_rating);

  return {
    gender,
    teeName: tee.tee_name?.trim() || `${gender === "male" ? "Men" : "Women"} tee`,
    courseRating: Number.isFinite(tee.course_rating)
      ? Number(tee.course_rating)
      : null,
    slopeRating: Number.isFinite(tee.slope_rating)
      ? Number(tee.slope_rating)
      : null,
    par: Number.isFinite(tee.par_total) ? Number(tee.par_total) : null,
    totalYards: Number.isFinite(tee.total_yards) ? Number(tee.total_yards) : null,
    holes,
    importable,
  };
}

function normalizeCourse(course: ApiCourse): ImportableCourse | null {
  if (!Number.isFinite(course.id)) return null;
  const tees = [
    ...(course.tees?.male ?? []).map((t) => normalizeTee(t, "male" as const)),
    ...(course.tees?.female ?? []).map((t) => normalizeTee(t, "female" as const)),
  ];
  return {
    id: Number(course.id),
    name: courseName(course),
    clubName: course.club_name?.trim() || "",
    courseName: course.course_name?.trim() || "",
    location: locationLabel(course),
    tees,
  };
}

async function golfCourseApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Key ${apiKey()}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("GolfCourseAPI rejected the API key.");
    }
    throw new Error(`GolfCourseAPI request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export async function searchGolfCourses(query: string): Promise<ImportableCourse[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await golfCourseApi<SearchResponse>(
    `/v1/search?search_query=${encodeURIComponent(q)}`,
  );
  return (data.courses ?? [])
    .map(normalizeCourse)
    .filter((course): course is ImportableCourse => course !== null)
    .slice(0, 12);
}

export async function getGolfCourse(id: number): Promise<ImportableCourse | null> {
  const course = await golfCourseApi<ApiCourse>(`/v1/courses/${id}`);
  return normalizeCourse(course);
}
