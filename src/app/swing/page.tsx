import { PageHeader, Card } from "@/components/ui";
import { VideoIcon } from "@/components/icons";

export default function SwingPage() {
  return (
    <div>
      <PageHeader
        title="Swing"
        subtitle="Upload swing videos and tie them to your misses and plans"
      />
      <Card className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <VideoIcon width={26} height={26} />
        </div>
        <div>
          <p className="text-lg font-medium">Coming soon</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Soon you&apos;ll be able to upload swing videos, tag them to a round
            or hole, and let the coach connect swing faults to your on-course
            miss patterns and practice plan.
          </p>
        </div>
        <ul className="mx-auto flex max-w-sm flex-col gap-2 text-left text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">•</span>
            Record or upload down-the-line and face-on clips
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">•</span>
            Tag a clip to a specific shot in a logged round
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">•</span>
            AI swing notes linked to your strokes-gained weaknesses
          </li>
        </ul>
      </Card>
    </div>
  );
}
