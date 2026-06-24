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
          <Link href="/courses/manual" className="text-sm text-muted hover:text-foreground">
            Manual fallback
          </Link>
        }
      />
      <CourseImportClient />
    </div>
  );
}
