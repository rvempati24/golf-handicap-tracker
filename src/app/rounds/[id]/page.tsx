import { notFound } from "next/navigation";
import Link from "next/link";
import { getRound } from "@/lib/rounds";
import { Button, Card, PageHeader } from "@/components/ui";
import { toParLabel } from "@/lib/scoring";
import { deleteRound } from "../actions";
import type { HoleResultView } from "@/lib/rounds";

export const dynamic = "force-dynamic";

// Golf-scorecard convention: circles for under par, squares for over par.
function scoreCellClass(strokes: number, par: number): string {
  const d = strokes - par;
  if (d <= -2)
    return "rounded-full border-2 border-gold text-gold ring-2 ring-gold/40";
  if (d === -1) return "rounded-full border-2 border-red-500 text-red-600 dark:text-red-300";
  if (d === 0) return "text-foreground";
  if (d === 1) return "rounded-md border border-sky-400 text-sky-600 dark:text-sky-300";
  return "rounded-md border-2 border-zinc-500 text-zinc-600 dark:text-zinc-300";
}

function NineTable({ holes, label }: { holes: HoleResultView[]; label: string }) {
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const totalStrokes = holes.reduce((a, h) => a + h.strokes, 0);
  const totalPutts = holes.reduce((a, h) => a + h.putts, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-center text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-1 text-left font-medium">{label}</th>
            {holes.map((h) => (
              <th key={h.holeNumber} className="w-8 font-medium">
                {h.holeNumber}
              </th>
            ))}
            <th className="px-1 font-medium">Tot</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-xs text-muted">
            <td className="px-1 text-left">Par</td>
            {holes.map((h) => (
              <td key={h.holeNumber}>{h.par}</td>
            ))}
            <td className="font-medium text-foreground">{totalPar}</td>
          </tr>
          <tr>
            <td className="px-1 text-left text-xs text-muted">Score</td>
            {holes.map((h) => (
              <td key={h.holeNumber} className="py-0.5">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center font-semibold tabular-nums ${scoreCellClass(h.strokes, h.par)}`}
                >
                  {h.strokes}
                </span>
              </td>
            ))}
            <td className="font-semibold tabular-nums">{totalStrokes}</td>
          </tr>
          <tr className="text-xs text-muted">
            <td className="px-1 text-left">Putts</td>
            {holes.map((h) => (
              <td key={h.holeNumber}>{h.putts}</td>
            ))}
            <td className="font-medium text-foreground">{totalPutts}</td>
          </tr>
          <tr className="text-xs text-muted">
            <td className="px-1 text-left">GIR</td>
            {holes.map((h) => (
              <td key={h.holeNumber}>{h.girHit ? "●" : "○"}</td>
            ))}
            <td>{holes.filter((h) => h.girHit).length}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const round = await getRound(id);
  if (!round) notFound();

  const { holes } = round;
  const totalStrokes = round.totalStrokes ?? holes.reduce((a, h) => a + h.strokes, 0);
  const toPar = totalStrokes - round.teePar;

  // Quick per-round stats (the full stats engine arrives in M4).
  const gir = holes.filter((h) => h.girHit).length;
  const fairwayHoles = holes.filter((h) => h.fairwayHit !== null);
  const fairwaysHit = fairwayHoles.filter((h) => h.fairwayHit).length;
  const putts = holes.reduce((a, h) => a + h.putts, 0);
  const threePutts = holes.filter((h) => h.putts >= 3).length;
  const penalties = holes.reduce((a, h) => a + h.penalties, 0);
  const udAtt = holes.filter((h) => h.upDownAttempt).length;
  const udMade = holes.filter((h) => h.upDownAttempt && h.upDownSuccess).length;
  const doubles = holes.filter((h) => h.strokes - h.par >= 2).length;

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={round.courseName}
        subtitle={`${round.datePlayed.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })} · ${round.teeName} (${round.courseRating}/${round.slopeRating})`}
        action={
          <Link href="/rounds" className="text-sm text-muted hover:text-foreground">
            ← All rounds
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Card className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted">Score</span>
          <span className="text-3xl font-semibold tabular-nums">
            {totalStrokes}{" "}
            <span className="text-lg text-muted">({toParLabel(toPar)})</span>
          </span>
        </Card>
        <Card className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted">
            Score differential
          </span>
          <span className="text-3xl font-semibold tabular-nums">
            {round.scoreDifferential != null
              ? round.scoreDifferential.toFixed(1)
              : "—"}
          </span>
          {round.scoreDifferential == null && (
            <span className="text-[10px] text-muted">
              available once recomputed
            </span>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <NineTable holes={holes.slice(0, 9)} label="Out" />
        <NineTable holes={holes.slice(9, 18)} label="In" />
      </Card>

      <section>
        <h2 className="mb-2 text-lg font-medium">Round stats</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("GIR", `${gir}/18`, `${Math.round((gir / 18) * 100)}%`)}
          {stat(
            "Fairways",
            fairwayHoles.length ? `${fairwaysHit}/${fairwayHoles.length}` : "—",
            fairwayHoles.length
              ? `${Math.round((fairwaysHit / fairwayHoles.length) * 100)}%`
              : "not tracked",
          )}
          {stat("Putts", String(putts), `${threePutts} three-putt${threePutts === 1 ? "" : "s"}`)}
          {stat("Penalties", String(penalties))}
          {stat(
            "Up & down",
            udAtt ? `${udMade}/${udAtt}` : "—",
            udAtt ? `${Math.round((udMade / udAtt) * 100)}%` : "not tracked",
          )}
          {stat("Doubles+", String(doubles))}
        </div>
      </section>

      {round.notes && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Notes</h2>
          <Card>
            <p className="whitespace-pre-wrap text-sm">{round.notes}</p>
          </Card>
        </section>
      )}

      <div className="flex gap-2">
        <Link href={`/rounds/${round.id}/edit`}>
          <Button variant="ghost">Edit round</Button>
        </Link>
        <form action={deleteRound}>
          <input type="hidden" name="id" value={round.id} />
          <Button variant="danger" type="submit">
            Delete
          </Button>
        </form>
      </div>
    </div>
  );
}
