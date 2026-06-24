-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "shotNumber" INTEGER NOT NULL,
    "club" TEXT,
    "shotType" TEXT NOT NULL,
    "startDistanceYards" INTEGER,
    "endDistanceYards" INTEGER,
    "startLie" TEXT,
    "endLie" TEXT,
    "result" TEXT,
    "penalty" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Shot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Shot_roundId_idx" ON "Shot"("roundId");

-- CreateIndex
CREATE INDEX "Shot_holeNumber_idx" ON "Shot"("holeNumber");

-- CreateIndex
CREATE INDEX "Shot_club_idx" ON "Shot"("club");

-- CreateIndex
CREATE INDEX "Shot_shotType_idx" ON "Shot"("shotType");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_roundId_holeNumber_shotNumber_key" ON "Shot"("roundId", "holeNumber", "shotNumber");
