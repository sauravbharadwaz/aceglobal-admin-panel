import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CLIENT_STATUS_STYLES,
  EXPERT_STATUS_STYLES,
  INVOICE_STATUS_STYLES,
  LEAD_STATUS_STYLES,
  MEETING_STATUS_STYLES,
  ONBOARDING_STATUS_STYLES,
  titleCase,
} from "@/lib/format";
import type {
  ClientStatus,
  ExpertStatus,
  InvoiceStatus,
  LeadStatus,
  MeetingStatus,
  OnboardingStatus,
} from "@/lib/types";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", LEAD_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", CLIENT_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function ExpertStatusBadge({ status }: { status: ExpertStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", EXPERT_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", MEETING_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", INVOICE_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", ONBOARDING_STATUS_STYLES[status])}
    >
      {titleCase(status)}
    </Badge>
  );
}
