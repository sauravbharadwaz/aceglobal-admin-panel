import { getMeetings } from "@/lib/data";
import { MeetingsTable } from "@/components/meetings/meetings-table";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
        <p className="text-sm text-muted-foreground">
          Scheduled calls and consultations with clients.
        </p>
      </div>
      <MeetingsTable meetings={meetings} />
    </div>
  );
}
