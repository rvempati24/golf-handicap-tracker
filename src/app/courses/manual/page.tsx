import Link from "next/link";
import { PageHeader } from "@/components/ui";
import CourseForm from "../CourseForm";
import { createCourse } from "../actions";

export default function ManualCoursePage() {
  return (
    <div>
      <PageHeader
        title="Manual course"
        subtitle="Enter par and stroke index for all 18 holes"
        action={
          <Link href="/courses/new" className="text-sm text-muted hover:text-foreground">
            Search instead
          </Link>
        }
      />
      <CourseForm action={createCourse} />
    </div>
  );
}
