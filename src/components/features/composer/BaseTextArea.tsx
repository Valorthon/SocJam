"use client";

interface BaseTextAreaProps {
  value: string;
  onChange: (value: string) => void;
}

export function BaseTextArea({ value, onChange }: BaseTextAreaProps) {
  return (
    <section
      className="rounded-lg border border-border bg-card p-4 sm:p-6"
      aria-labelledby="base-draft-heading"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="base-draft-heading"
          className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Your draft
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {value.length} characters
        </span>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-40 w-full resize-y bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="What's on your mind? Start typing to generate variations..."
        aria-label="Post draft"
      />
    </section>
  );
}
