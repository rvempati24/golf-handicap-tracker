import Link from "next/link";
import { PageHeader } from "@/components/ui";
import CourseImportClient from "./CourseImportClient";

export default function ImportCoursePage() {
  return (
    <div>
      <PageHeader
        title="Import course"
        subtitle="Search GolfCourseAPI and import a tee set"
        action={
          <Link href="/courses" className="text-sm text-muted hover:text-foreground">
            Back to courses
          </Link>
        }
      />
      <CourseImportClient />
    </div>
  );
}
