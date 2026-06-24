import { notFound } from "next/navigation";
import { getRound } from "@/lib/rounds";
import { getCourses } from "@/lib/courses";
import { PageHeader } from "@/components/ui";
import RoundForm, {
  type CourseOption,
  type RoundFormInitial,
} from "../../RoundForm";
import { updateRound } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [round, courses] = await Promise.all([getRound(id), getCourses()]);
  if (!round) notFound();

  const options: CourseOption[] = courses
    .filter((c) => c.teeSets.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      par: c.par,
      holePars: c.holePars,
      holeStrokeIndex: c.holeStrokeIndex,
      teeSets: c.teeSets.map((t) => ({
        id: t.id,
        name: t.name,
        courseRating: t.courseRating,
        slopeRating: t.slopeRating,
        par: t.par,
      })),
    }));

  const initial: RoundFormInitial = {
    id: round.id,
    datePlayed: round.datePlayed.toISOString().slice(0, 10),
    courseId: round.courseId,
    teeSetId: round.teeSetId,
    pcc: round.pcc,
    notes: round.notes,
    weather: round.weather,
    holes: round.holes.map((h) => ({
      par: h.par,
      strokeIndex: h.strokeIndex,
      strokes: h.strokes,
      putts: h.putts,
      fairwayHit: h.fairwayHit,
      girHit: h.girHit,
      penalties: h.penalties,
      upDownAttempt: h.upDownAttempt,
      upDownSuccess: h.upDownSuccess,
      sandAttempt: h.sandAttempt,
      sandSuccess: h.sandSuccess,
      driveDistance: h.driveDistance,
    })),
    shots: round.shots.map((s) => ({
      holeNumber: s.holeNumber,
      shotNumber: s.shotNumber,
      club: s.club,
      shotType: s.shotType,
      startDistanceYards: s.startDistanceYards,
      endDistanceYards: s.endDistanceYards,
      startLie: s.startLie,
      endLie: s.endLie,
      result: s.result,
      penalty: s.penalty,
    })),
  };

  return (
    <div>
      <PageHeader title="Edit round" subtitle={round.courseName} />
      <RoundForm
        courses={options}
        initial={initial}
        action={updateRound.bind(null, round.id)}
      />
    </div>
  );
}
