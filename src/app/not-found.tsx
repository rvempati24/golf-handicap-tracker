import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-4xl">⛳</p>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted">That hole isn&apos;t on the card.</p>
      <Link
        href="/"
        className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
