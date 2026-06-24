"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import type { ImportableCourse, ImportableTee } from "@/lib/golf-course-api";
import { importCourseFromApi, searchCourseImport } from "./actions";

function teeLabel(tee: ImportableTee) {
  const side = tee.gender === "male" ? "Men" : "Women";
  const yards = tee.totalYards ? ` / ${tee.totalYards} yds` : "";
  const rating =
    tee.courseRating != null && tee.slopeRating != null
      ? ` / ${tee.courseRating}/${tee.slopeRating}`
      : "";
  return `${side} ${tee.teeName}${rating}${yards}`;
}

export default function CourseImportClient() {
  const { ownerKey, setOwnerKey } = useOwnerKey();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<ImportableCourse[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importedCourseId, setImportedCourseId] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [importPending, startImport] = useTransition();

  const importableCount = useMemo(
    () => courses.reduce((sum, c) => sum + c.tees.filter((t) => t.importable).length, 0),
    [courses],
  );

  function selectedTee(course: ImportableCourse): ImportableTee | null {
    const key = selected[course.id];
    if (!key) return course.tees.find((t) => t.importable) ?? null;
    const [gender, ...nameParts] = key.split(":");
    const teeName = nameParts.join(":");
    return (
      course.tees.find((t) => t.gender === gender && t.teeName === teeName) ?? null
    );
  }

  function onSearch() {
    setError(null);
    setMessage(null);
    setImportedCourseId(null);
    startSearch(async () => {
      const res = await searchCourseImport({ ownerKey, query });
      if (!res.ok) {
        setError(res.error);
        setCourses([]);
        return;
      }
      setCourses(res.courses);
      if (res.courses.length === 0) {
        setMessage("No matching courses found.");
      }
    });
  }

  function onImport(course: ImportableCourse) {
    const tee = selectedTee(course);
    if (!tee) {
      setError("Select an importable tee set first.");
      return;
    }
    setError(null);
    setMessage(null);
    setImportedCourseId(null);
    startImport(async () => {
      const res = await importCourseFromApi({
        ownerKey,
        courseId: course.id,
        gender: tee.gender,
        teeName: tee.teeName,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(res.message);
      setImportedCourseId(res.courseId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <OwnerKeyField value={ownerKey} onValueChange={setOwnerKey} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            placeholder="Course or club name"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm transition placeholder:text-muted/70"
          />
        </label>
        <div>
          <Button onClick={onSearch} disabled={searchPending}>
            {searchPending ? "Searching..." : "Search courses"}
          </Button>
        </div>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {message && (
        <div className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-sm">
          <p>{message}</p>
          {importedCourseId && (
            <Link
              href={`/courses/${importedCourseId}`}
              className="mt-1 inline-block font-medium text-accent"
            >
              Open imported course
            </Link>
          )}
        </div>
      )}

      {courses.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Found {courses.length} courses with {importableCount} importable tee set
            {importableCount === 1 ? "" : "s"}.
          </p>

          {courses.map((course) => {
            const importableTees = course.tees.filter((t) => t.importable);
            const tee = selectedTee(course);
            return (
              <Card key={course.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{course.name}</h2>
                    <p className="text-sm text-muted">
                      {course.location ?? "Location unavailable"}
                    </p>
                  </div>
                  <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">
                    API #{course.id}
                  </span>
                </div>

                {importableTees.length > 0 ? (
                  <>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Tee set
                      </span>
                      <select
                        value={
                          tee ? `${tee.gender}:${tee.teeName}` : ""
                        }
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [course.id]: e.target.value,
                          }))
                        }
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                      >
                        {importableTees.map((t) => (
                          <option
                            key={`${t.gender}:${t.teeName}`}
                            value={`${t.gender}:${t.teeName}`}
                          >
                            {teeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {tee && (
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">
                            Rating
                          </p>
                          <p className="font-semibold tabular-nums">
                            {tee.courseRating}/{tee.slopeRating}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">
                            Par
                          </p>
                          <p className="font-semibold tabular-nums">{tee.par}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">
                            Yardage
                          </p>
                          <p className="font-semibold tabular-nums">
                            {tee.totalYards ?? "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted">
                            Holes
                          </p>
                          <p className="font-semibold tabular-nums">
                            {tee.holes.length}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <Button
                        onClick={() => onImport(course)}
                        disabled={importPending}
                      >
                        {importPending ? "Importing..." : "Import selected tee"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
                    This result does not include complete 18-hole rating, slope,
                    and stroke-index data.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
