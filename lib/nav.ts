import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  CalendarDays,
  FileText,
  MessageSquare,
  TrendingUp,
  UserCog,
  Star,
  Timer,
  BarChart3,
  Wallet,
  Settings,
  Users2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardList },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/chats", label: "Chats", icon: MessageSquare },
];

export const ADMIN_ITEMS: NavItem[] = [
  { href: "/expert-performance", label: "Expert Performance", icon: TrendingUp },
  { href: "/experts", label: "Manage Experts", icon: UserCog },
  { href: "/expert-reviews", label: "Expert Reviews", icon: Star },
  { href: "/tat-metrics", label: "TAT Metrics", icon: Timer },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/team", label: "Team", icon: Users2 },
  { href: "/settings", label: "Settings", icon: Settings },
];
