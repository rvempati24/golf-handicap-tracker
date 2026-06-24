// Recompute all cached differentials and the handicap trend from scratch.
// Run: `npm run db:recompute`.
import { recomputeHandicap, getHandicapState } from "../src/lib/handicap";

async function main() {
  const index = await recomputeHandicap();
  const state = await getHandicapState();
  console.log(
    `Recomputed ${state.roundCount} rounds. ` +
      `Handicap Index: ${index ?? "not established"} ` +
      `(${state.trend.length} snapshots).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
