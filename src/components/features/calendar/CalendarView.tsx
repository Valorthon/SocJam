"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PostListItemDto } from "@/types";

import { CalendarDayCell } from "./CalendarDayCell";

interface CalendarViewProps {
  timezone: string;
  posts: PostListItemDto[];
  onPostClick: (postId: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  const end = new Date(year, month + 1, 6 - new Date(year, month + 1, 0).getDay());
  const days: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function CalendarView({
  timezone,
  posts,
  onPostClick,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const days = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7));
    }
    return result;
  }, [days]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostListItemDto[]>();
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const date = new Date(post.scheduledAt);
      const key = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      const existing = map.get(key) ?? [];
      existing.push(post);
      map.set(key, existing);
    }
    return map;
  }, [posts, timezone]);

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{formatMonthYear(currentMonth)}</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={previousMonth}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={nextMonth}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-muted/30 px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {weeks.flatMap((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const key = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(day);
            const dayPosts = postsByDay.get(key) ?? [];

            return (
              <CalendarDayCell
                key={`${weekIndex}-${dayIndex}`}
                date={day}
                timezone={timezone}
                isCurrentMonth={isCurrentMonth}
                posts={dayPosts}
                onPostClick={onPostClick}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
