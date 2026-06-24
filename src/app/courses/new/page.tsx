import Link from "next/link";
import { PageHeader } from "@/components/ui";
import CourseImportClient from "../import/CourseImportClient";

export default function NewCoursePage() {
  return (
    <div>
      <PageHeader
        title="Add course"
        subtitle="Search and import tee data first"
        action={
          <div className="flex gap-3 text-sm">
            <Link href="/courses/scorecard" className="text-muted hover:text-foreground">
              Import scorecard
            </Link>
            <Link href="/courses/manual" className="text-muted hover:text-foreground">
              Manual fallback
            </Link>
          </div>
        }
      />
      <CourseImportClient />
    </div>
  );
}
