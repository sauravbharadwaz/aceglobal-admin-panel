"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { AdminMenu } from "@/components/admin-menu";
import { MobileNav } from "@/components/mobile-nav";

export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/60 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Mobile hamburger */}
        <MobileNav email={email} />

        {/* Logo */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Ace Global
          </span>
        </Link>

        {/* Search (desktop only) */}
        <div className="relative hidden flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name, email or phone"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-16 text-sm outline-none ring-ring/40 placeholder:text-muted-foreground focus-visible:ring-2"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        {/* Desktop nav links + admin menu */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}
          <AdminMenu email={email} />
        </nav>
      </div>
    </header>
  );
}
