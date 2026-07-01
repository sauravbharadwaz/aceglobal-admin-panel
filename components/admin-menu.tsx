"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  TrendingUp,
  UserCog,
  Star,
  Timer,
  BarChart3,
  Wallet,
  Settings,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/expert-performance", label: "Expert Performance", icon: TrendingUp },
  { href: "/experts", label: "Manage Experts", icon: UserCog },
  { href: "/expert-reviews", label: "Expert Reviews", icon: Star },
  { href: "/tat-metrics", label: "TAT Metrics", icon: Timer },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Self-contained Admin dropdown. Built with plain React (no Base UI Menu) so it
 * renders reliably. Closes on outside-click, Escape, or navigation.
 */
export function AdminMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const initials = email.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline">Admin</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">Signed in as</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            <LogOut className="size-4" />
            {isSigningOut ? "Signing out…" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
