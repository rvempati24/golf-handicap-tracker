-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "par" INTEGER NOT NULL DEFAULT 72,
    "holePars" TEXT NOT NULL,
    "holeStrokeIndex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "TeeSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseRating" DOUBLE PRECISION NOT NULL,
    "slopeRating" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "yardages" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeeSet_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datePlayed" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "teeSetId" TEXT NOT NULL,
    "pcc" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "weather" TEXT,
    "totalStrokes" INTEGER,
    "adjustedGrossScore" INTEGER,
    "scoreDifferential" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Round_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_teeSetId_fkey" FOREIGN KEY ("teeSetId") REFERENCES "TeeSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HoleResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "strokeIndex" INTEGER NOT NULL,
    "strokes" INTEGER NOT NULL,
    "putts" INTEGER NOT NULL,
    "girHit" BOOLEAN NOT NULL DEFAULT false,
    "fairwayHit" BOOLEAN,
    "penalties" INTEGER NOT NULL DEFAULT 0,
    "upDownAttempt" BOOLEAN NOT NULL DEFAULT false,
    "upDownSuccess" BOOLEAN NOT NULL DEFAULT false,
    "sandAttempt" BOOLEAN NOT NULL DEFAULT false,
    "sandSuccess" BOOLEAN NOT NULL DEFAULT false,
    "driveDistance" INTEGER,
    CONSTRAINT "HoleResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandicapSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TIMESTAMP(3) NOT NULL,
    "indexValue" DOUBLE PRECISION NOT NULL,
    "roundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TeeSet_courseId_idx" ON "TeeSet"("courseId");

-- CreateIndex
CREATE INDEX "Round_courseId_idx" ON "Round"("courseId");

-- CreateIndex
CREATE INDEX "Round_teeSetId_idx" ON "Round"("teeSetId");

-- CreateIndex
CREATE INDEX "Round_datePlayed_idx" ON "Round"("datePlayed");

-- CreateIndex
CREATE INDEX "HoleResult_roundId_idx" ON "HoleResult"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "HoleResult_roundId_holeNumber_key" ON "HoleResult"("roundId", "holeNumber");

-- CreateIndex
CREATE INDEX "HandicapSnapshot_date_idx" ON "HandicapSnapshot"("date");
