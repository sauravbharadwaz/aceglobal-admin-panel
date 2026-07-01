import type { ClientStatus, LeadStatus, OnboardingStatus } from "@/lib/types";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "4d ago", "3h ago", "just now" — mirrors the Recent Activity feed. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Tailwind classes for lead status badges (soft, Rally-style pills). */
export const LEAD_STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-violet-50 text-violet-700 border-violet-200",
  converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
};

export const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  onboarding: "bg-blue-50 text-blue-700 border-blue-200",
  inactive: "bg-neutral-100 text-neutral-600 border-neutral-200",
  churned: "bg-rose-50 text-rose-700 border-rose-200",
};

export const ONBOARDING_STATUS_STYLES: Record<OnboardingStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  quoted: "bg-violet-50 text-violet-700 border-violet-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
};

export function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
