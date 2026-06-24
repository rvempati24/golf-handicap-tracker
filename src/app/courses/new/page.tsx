import { PageHeader } from "@/components/ui";
import CourseForm from "../CourseForm";
import { createCourse } from "../actions";

export default function NewCoursePage() {
  return (
    <div>
      <PageHeader
        title="Add course"
        subtitle="Enter par and stroke index for all 18 holes"
      />
      <CourseForm action={createCourse} />
    </div>
  );
}
