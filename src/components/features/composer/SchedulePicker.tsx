"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateScheduleTimeOptions,
  localDateTimeToUtc,
  nextScheduleSlot,
  tomorrowAt,
  utcToLocalDateTime,
} from "@/lib/date";

interface SchedulePickerProps {
  timezone: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SchedulePicker({
  timezone,
  value,
  onChange,
}: SchedulePickerProps) {
  const timeOptions = useMemo(() => generateScheduleTimeOptions(), []);
  const [{ date, time }, setLocal] = useState(() => {
    const initial = value ? new Date(value) : new Date();
    return utcToLocalDateTime(initial, timezone);
  });

  useEffect(() => {
    if (!value) return;
    setLocal(utcToLocalDateTime(new Date(value), timezone));
  }, [value, timezone]);

  const updateDate = (nextDate: string) => {
    setLocal((current) => {
      const next = { ...current, date: nextDate };
      onChange(localDateTimeToUtc(next, timezone).toISOString());
      return next;
    });
  };

  const updateTime = (nextTime: string) => {
    setLocal((current) => {
      const next = { ...current, time: nextTime };
      onChange(localDateTimeToUtc(next, timezone).toISOString());
      return next;
    });
  };

  const applyPreset = (local: { date: string; time: string }) => {
    setLocal(local);
    onChange(localDateTimeToUtc(local, timezone).toISOString());
  };

  const handlePresetInOneHour = () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    applyPreset(nextScheduleSlot(oneHourLater, timezone));
  };

  const handlePresetTomorrowNine = () => {
    applyPreset(tomorrowAt(9, 0, timezone));
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="size-4" />
        <span>Schedule post</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="schedule-date" className="text-xs">
            Date
          </Label>
          <Input
            id="schedule-date"
            type="date"
            value={date}
            onChange={(event) => updateDate(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-time" className="text-xs">
            Time
          </Label>
          <Select value={time} onValueChange={updateTime}>
            <SelectTrigger id="schedule-time">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {timeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePresetInOneHour}
        >
          In 1 hour
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePresetTomorrowNine}
        >
          Tomorrow 9:00
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="size-3.5" />
        <span>Times shown in {timezone}</span>
      </div>
    </div>
  );
}
