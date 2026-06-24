"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "⛳" },
  { href: "/rounds/new", label: "New", icon: "➕" },
  { href: "/rounds", label: "Rounds", icon: "📋" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/insights", label: "Insights", icon: "🤖" },
  { href: "/courses", label: "Courses", icon: "🏌️" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // /rounds/new should not light up /rounds
  if (href === "/rounds") return pathname === "/rounds" || /^\/rounds\/[^/]+$/.test(pathname) && pathname !== "/rounds/new";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Top bar — desktop / tablet */}
      <header className="sticky top-0 z-20 hidden border-b border-border bg-surface/90 backdrop-blur sm:block">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
          <Link href="/" className="mr-3 flex items-center gap-2 font-semibold">
            <span className="text-xl">⛳</span>
            <span>Golf Tracker</span>
          </Link>
          <div className="flex flex-1 items-center gap-1">
            {LINKS.filter((l) => l.href !== "/").map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(pathname, l.href)
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
