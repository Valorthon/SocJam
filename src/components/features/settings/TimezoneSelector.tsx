"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserTimezone } from "@/app/(app)/settings/actions";

interface TimezoneSelectorProps {
  currentTimezone: string;
}

function getSortedTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone").sort();
  } catch {
    return ["UTC"];
  }
}

export function TimezoneSelector({ currentTimezone }: TimezoneSelectorProps) {
  const timeZones = useMemo(() => getSortedTimeZones(), []);
  const [selected, setSelected] = useState(currentTimezone);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = selected !== currentTimezone;

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateUserTimezone(selected);
      if (result.success) {
        setMessage("Timezone saved.");
      } else {
        setMessage(result.error ?? "Unable to save timezone.");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="timezone" className="text-sm font-medium">
          Timezone
        </Label>
        <p className="text-xs text-muted-foreground">
          Scheduled posts and publish times are shown in this timezone.
        </p>
      </div>

      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger id="timezone" className="w-full sm:max-w-md">
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {timeZones.map((timeZone) => (
            <SelectItem key={timeZone} value={timeZone}>
              {timeZone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          disabled={!hasChanges || isPending}
          onClick={handleSave}
        >
          {isPending ? "Saving…" : "Save timezone"}
        </Button>
        {message ? (
          <p
            className={`text-xs ${message === "Timezone saved." ? "text-muted-foreground" : "text-destructive"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
