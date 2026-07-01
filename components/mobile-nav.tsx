"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_ITEMS } from "@/lib/nav";
import { signOut } from "@/app/auth/actions";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, startTransition] = useTransition();
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function itemClass(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-accent text-accent-foreground"
        : "text-foreground hover:bg-muted",
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 flex h-full w-[85%] max-w-xs flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  A
                </span>
                <span className="text-base font-semibold tracking-tight">Ace Global</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* Search */}
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search…"
                  className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none ring-ring/40 placeholder:text-muted-foreground focus-visible:ring-2"
                />
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={itemClass(href)}>
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="my-3 h-px bg-border" />
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Admin
              </p>
              <nav className="space-y-1">
                {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={itemClass(href)}>
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="border-t p-3">
              <p className="px-3 pb-2 text-xs text-muted-foreground">
                <span className="text-foreground">Signed in as</span>
                <br />
                {email}
              </p>
              <button
                type="button"
                onClick={() => startTransition(async () => { await signOut(); })}
                disabled={isSigningOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
              >
                <LogOut className="size-4" />
                {isSigningOut ? "Signing out…" : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
