"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import type { ImportableCourse, ImportableTee } from "@/lib/golf-course-api";
import { importCourseFromApi, searchCourseImport } from "./actions";

function teeKey(tee: ImportableTee) {
  return `${tee.gender}:${tee.teeIndex}`;
}

function teeLabel(tee: ImportableTee) {
  const side = tee.gender === "male" ? "Men" : "Women";
  const yards = tee.totalYards ? ` / ${tee.totalYards} yds` : "";
  const rating =
    tee.courseRating != null && tee.slopeRating != null
      ? ` / ${tee.courseRating}/${tee.slopeRating}`
      : "";
  return `${side} ${tee.teeName}${rating}${yards}`;
}

function selectedTeeFromKey(
  course: ImportableCourse | null,
  key: string,
): ImportableTee | null {
  if (!course) return null;
  const [gender, index] = key.split(":");
  const fallback = course.tees.find((tee) => tee.importable) ?? null;
  if (!gender || index == null) return fallback;
  return (
    course.tees.find(
      (tee) => tee.gender === gender && tee.teeIndex === Number(index),
    ) ?? fallback
  );
}

export default function CourseImportClient() {
  const { ownerKey, setOwnerKey } = useOwnerKey();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<ImportableCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedTeeKey, setSelectedTeeKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importedCourseId, setImportedCourseId] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [importPending, startImport] = useTransition();
  const requestId = useRef(0);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null;
  const importableTees = selectedCourse?.tees.filter((tee) => tee.importable) ?? [];
  const selectedTee =
    selectedTeeFromKey(selectedCourse, selectedTeeKey) ?? importableTees[0] ?? null;

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((course) =>
      [course.name, course.location ?? "", course.clubName, course.courseName]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [courses, query]);

  const importableCount = useMemo(
    () =>
      filteredCourses.reduce(
        (sum, course) => sum + course.tees.filter((tee) => tee.importable).length,
        0,
      ),
    [filteredCourses],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      const q = query.trim();
      requestId.current += 1;
      const currentRequest = requestId.current;

      if (q.length < 2) {
        setCourses([]);
        setSelectedCourseId(null);
        setSelectedTeeKey("");
        setError(null);
        setMessage(null);
        setImportedCourseId(null);
        return;
      }

      if (!ownerKey.trim()) {
        setCourses([]);
        setSelectedCourseId(null);
        setSelectedTeeKey("");
        setError("Enter the owner key to search and import courses.");
        setMessage(null);
        setImportedCourseId(null);
        return;
      }

      setError(null);
      setMessage(null);
      setImportedCourseId(null);
      startSearch(async () => {
        const res = await searchCourseImport({ ownerKey, query: q });
        if (currentRequest !== requestId.current) return;
        if (!res.ok) {
          setError(res.error);
          setCourses([]);
          setSelectedCourseId(null);
          setSelectedTeeKey("");
          return;
        }
        setCourses(res.courses);
        const first = res.courses[0] ?? null;
        const firstTee = first?.tees.find((tee) => tee.importable) ?? null;
        setSelectedCourseId(first?.id ?? null);
        setSelectedTeeKey(firstTee ? teeKey(firstTee) : "");
        if (res.courses.length === 0) {
          setMessage("No matching courses found.");
        }
      });
    }, 350);

    return () => window.clearTimeout(id);
  }, [ownerKey, query]);

  function chooseCourse(course: ImportableCourse) {
    const firstTee = course.tees.find((tee) => tee.importable) ?? null;
    setSelectedCourseId(course.id);
    setSelectedTeeKey(firstTee ? teeKey(firstTee) : "");
    setError(null);
    setMessage(null);
    setImportedCourseId(null);
  }

  function onImport() {
    if (!selectedCourse || !selectedTee) {
      setError("Select an importable tee set first.");
      return;
    }
    setError(null);
    setMessage(null);
    setImportedCourseId(null);
    startImport(async () => {
      const res = await importCourseFromApi({
        ownerKey,
        courseId: selectedCourse.id,
        gender: selectedTee.gender,
        teeIndex: selectedTee.teeIndex,
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
      <Card className="grid gap-3 md:grid-cols-[16rem_1fr]">
        <OwnerKeyField value={ownerKey} onValueChange={setOwnerKey} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Search courses
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a course or club name"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm transition placeholder:text-muted/70"
          />
        </label>
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

      {query.trim().length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-medium">Matches</p>
              <p className="text-xs text-muted">
                {searchPending
                  ? "Searching..."
                  : `${filteredCourses.length} courses / ${importableCount} tees`}
              </p>
            </div>

            <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
              {filteredCourses.map((course) => {
                const active = selectedCourse?.id === course.id;
                const teeCount = course.tees.filter((tee) => tee.importable).length;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => chooseCourse(course)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-accent/40 bg-accent-soft"
                        : "border-border bg-background hover:border-border-strong"
                    }`}
                  >
                    <span className="block text-sm font-medium">{course.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {course.location ?? "Location unavailable"}
                    </span>
                    <span className="mt-1 block text-[11px] uppercase tracking-wider text-muted">
                      {teeCount} importable tee{teeCount === 1 ? "" : "s"}
                    </span>
                  </button>
                );
              })}

              {!searchPending && filteredCourses.length === 0 && (
                <p className="rounded-lg border border-border bg-background px-3 py-6 text-center text-sm text-muted">
                  No matches yet.
                </p>
              )}
            </div>
          </Card>

          <Card className="flex min-h-[22rem] flex-col gap-4">
            {selectedCourse ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">{selectedCourse.name}</h2>
                    <p className="text-sm text-muted">
                      {selectedCourse.location ?? "Location unavailable"}
                    </p>
                  </div>
                  <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted">
                    API #{selectedCourse.id}
                  </span>
                </div>

                {importableTees.length > 0 ? (
                  <>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Tee set
                      </span>
                      <select
                        value={selectedTee ? teeKey(selectedTee) : ""}
                        onChange={(e) => setSelectedTeeKey(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                      >
                        {importableTees.map((tee) => (
                          <option key={teeKey(tee)} value={teeKey(tee)}>
                            {teeLabel(tee)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedTee && (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted">
                              Rating
                            </p>
                            <p className="font-semibold tabular-nums">
                              {selectedTee.courseRating}/{selectedTee.slopeRating}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted">
                              Par
                            </p>
                            <p className="font-semibold tabular-nums">
                              {selectedTee.par}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted">
                              Yardage
                            </p>
                            <p className="font-semibold tabular-nums">
                              {selectedTee.totalYards ?? "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted">
                              Holes
                            </p>
                            <p className="font-semibold tabular-nums">
                              {selectedTee.holes.length}
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-separate border-spacing-1 text-center text-xs">
                            <thead className="text-muted">
                              <tr>
                                <th className="text-left font-medium">Hole</th>
                                {selectedTee.holes.map((_, i) => (
                                  <th key={i} className="font-medium">
                                    {i + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <th className="text-left font-medium text-muted">Par</th>
                                {selectedTee.holes.map((hole, i) => (
                                  <td key={i}>{hole.par}</td>
                                ))}
                              </tr>
                              <tr>
                                <th className="text-left font-medium text-muted">SI</th>
                                {selectedTee.holes.map((hole, i) => (
                                  <td key={i}>{hole.handicap}</td>
                                ))}
                              </tr>
                              <tr>
                                <th className="text-left font-medium text-muted">Yds</th>
                                {selectedTee.holes.map((hole, i) => (
                                  <td key={i}>{hole.yardage ?? "-"}</td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    <div>
                      <Button onClick={onImport} disabled={importPending}>
                        {importPending ? "Importing..." : "Import selected tee"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-border bg-background px-3 py-8 text-center text-sm text-muted">
                    This result does not include complete 18-hole rating, slope,
                    and stroke-index data.
                  </p>
                )}
              </>
            ) : (
              <p className="m-auto text-sm text-muted">
                Select a course result to review its tee sets.
              </p>
            )}
          </Card>
        </div>
      )}

      <p className="text-sm text-muted">
        Cannot find the course?{" "}
        <Link href="/courses/new" className="font-medium text-accent">
          Add it manually
        </Link>
        .
      </p>
    </div>
  );
}
