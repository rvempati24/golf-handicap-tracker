import { PrismaClient } from "@prisma/client";
import { serializeHoleArray } from "../src/lib/holes";

const prisma = new PrismaClient();

// Coyote Crossing Golf Club — West Lafayette, IN. Par 72.
// Per-hole pars / stroke index / yardages below are reasonable defaults
// the user can correct in the Courses editor.
const HOLE_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4];
// Odd indexes on the front nine, even on the back — a standard allocation.
const STROKE_INDEX = [7, 3, 15, 1, 11, 5, 17, 13, 9, 4, 8, 2, 18, 6, 12, 16, 10, 14];
// Black tees, totals 6,839 yds.
const BLACK_YARDAGES = [
  410, 420, 175, 555, 400, 405, 195, 395, 540, 390, 380, 535, 165, 419, 370,
  205, 520, 360,
];

async function main() {
  const existing = await prisma.course.findFirst({
    where: { name: "Coyote Crossing Golf Club" },
  });
  if (existing) {
    console.log("Seed: Coyote Crossing already present, skipping.");
    return;
  }

  const course = await prisma.course.create({
    data: {
      name: "Coyote Crossing Golf Club",
      location: "West Lafayette, IN",
      par: 72,
      holePars: serializeHoleArray(HOLE_PARS),
      holeStrokeIndex: serializeHoleArray(STROKE_INDEX),
      teeSets: {
        create: [
          {
            name: "Black",
            courseRating: 72.9,
            slopeRating: 140,
            par: 72,
            yardages: serializeHoleArray(BLACK_YARDAGES),
          },
        ],
      },
    },
    include: { teeSets: true },
  });

  console.log(
    `Seed: created "${course.name}" with ${course.teeSets.length} tee set(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
