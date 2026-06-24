-- CreateTable
CREATE TABLE "InsightReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "question" TEXT,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InsightReport_createdAt_idx" ON "InsightReport"("createdAt");
