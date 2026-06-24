import Link from "next/link";
import { PageHeader } from "@/components/ui";
import ScorecardImportClient from "./ScorecardImportClient";
import { createCourseFromScorecard } from "./actions";

export default function ScorecardImportPage() {
  return (
    <div>
      <PageHeader
        title="Import scorecard"
        subtitle="Create a course from an empty scorecard photo"
        action={
          <Link href="/courses/new" className="text-sm text-muted hover:text-foreground">
            Search instead
          </Link>
        }
      />
      <ScorecardImportClient action={createCourseFromScorecard} />
    </div>
  );
}
