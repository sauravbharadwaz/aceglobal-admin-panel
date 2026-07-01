"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  CalendarDays,
  FileText,
  MessageSquare,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminMenu } from "@/components/admin-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardList },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/chats", label: "Chats", icon: MessageSquare },
];

export function TopNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Ace Global
          </span>
        </Link>

        {/* Search (decorative ⌘K affordance) */}
        <div className="relative hidden flex-1 md:block">
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

        {/* Nav links */}
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
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
