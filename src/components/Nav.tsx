"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  FlagIcon,
  PlusIcon,
  ListIcon,
  ChartIcon,
  SparkIcon,
  PinIcon,
} from "@/components/icons";

type NavLink = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", Icon: FlagIcon },
  { href: "/rounds/new", label: "New", Icon: PlusIcon },
  { href: "/rounds", label: "Rounds", Icon: ListIcon },
  { href: "/stats", label: "Stats", Icon: ChartIcon },
  { href: "/insights", label: "Insights", Icon: SparkIcon },
  { href: "/courses", label: "Courses", Icon: PinIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/rounds")
    return (
      pathname === "/rounds" ||
      (/^\/rounds\/[^/]+/.test(pathname) && pathname !== "/rounds/new")
    );
  return pathname === href || pathname.startsWith(href + "/");
}

function BrandMark() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg">
      <FlagIcon width={16} height={16} />
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar — desktop / tablet */}
      <header className="sticky top-0 z-20 hidden border-b border-border/70 bg-background/80 backdrop-blur-md sm:block">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3">
          <Link href="/" className="mr-4 flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight">
              Rishab Golf
            </span>
          </Link>
          <div className="flex flex-1 items-center gap-1">
            {LINKS.filter((l) => l.href !== "/").map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <l.Icon width={16} height={16} />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Mobile top brand */}
      <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-md sm:hidden">
        <BrandMark />
        <span className="text-[15px] font-semibold tracking-tight">
          Rishab Golf
        </span>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {active && (
                <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" />
              )}
              <l.Icon width={20} height={20} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
