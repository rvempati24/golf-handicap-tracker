import Link from "next/link";
import { FlagIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-accent-soft text-accent">
        <FlagIcon width={24} height={24} />
      </div>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted">That hole isn&apos;t on the card.</p>
      <Link
        href="/"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
