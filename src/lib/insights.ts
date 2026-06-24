import { prisma } from "@/lib/prisma";
import type { Insight, InsightReportView } from "@/app/insights/actions";

export async function getInsightReports(
  limit = 20,
): Promise<InsightReportView[]> {
  const rows = await prisma.insightReport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r): InsightReportView => {
    if (r.kind === "question") {
      return {
        id: r.id,
        kind: "question",
        createdAt: r.createdAt.toISOString(),
        model: r.model,
        question: r.question ?? "",
        answer: r.content,
      };
    }
    return {
      id: r.id,
      kind: "insight",
      createdAt: r.createdAt.toISOString(),
      model: r.model,
      insight: JSON.parse(r.content) as Insight,
    };
  });
}
