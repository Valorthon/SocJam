import { CalendarClient } from "@/components/features/calendar/CalendarClient";
import { getRequiredAppUser } from "@/lib/app-user";

export default async function CalendarPage() {
  const user = await getRequiredAppUser();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Month view of your scheduled posts. Week view is planned for a future
          update.
        </p>
      </div>
      <CalendarClient timezone={user.timezone} />
    </div>
  );
}
