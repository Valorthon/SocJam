"use client";

import { COMPOSER_TONES, type ComposerTone } from "@/stores/composerStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ToneSelectorProps {
  value: ComposerTone;
  onChange: (tone: ComposerTone) => void;
}

function formatTone(tone: ComposerTone): string {
  return tone.charAt(0) + tone.slice(1).toLowerCase();
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono uppercase tracking-wide">Tone</span>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as ComposerTone)}
      >
        <SelectTrigger className="w-28" aria-label="AI adaptation tone">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPOSER_TONES.map((tone) => (
            <SelectItem key={tone} value={tone}>{formatTone(tone)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
