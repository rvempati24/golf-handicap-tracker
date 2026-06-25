"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { SparkIcon, ChevronRight, LockIcon } from "@/components/icons";
import { useOwner } from "@/components/OwnerProvider";

export default function DashboardInsightCard({
  headline,
  topFocus,
}: {
  headline: string | null;
  topFocus: string | null;
}) {
  const { unlocked } = useOwner();

  const body = headline ? (
    <>
      <p className="mt-0.5 text-sm">{headline}</p>
      {topFocus && <p className="mt-1 text-xs text-muted">Top focus: {topFocus}</p>}
    </>
  ) : (
    <p className="mt-0.5 text-sm text-muted">
      Generate weaknesses, what&apos;s improving, and practice priorities from
      your data.
    </p>
  );

  // Locked: don't route into the gated page — show a warning instead.
  if (!unlocked) {
    return (
      <Card className="opacity-80">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
            <LockIcon width={18} height={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">AI coaching insights</p>
            <p className="mt-0.5 text-sm text-muted">
              Enter your owner key with the key button in the top-right corner to
              unlock AI coaching insights.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Link href="/insights" className="group block">
      <Card className="transition hover:border-border-strong hover:shadow-pop">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <SparkIcon width={18} height={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">AI coaching insights</p>
              <ChevronRight
                width={18}
                height={18}
                className="text-muted transition group-hover:translate-x-0.5"
              />
            </div>
            {body}
          </div>
        </div>
      </Card>
    </Link>
  );
}
