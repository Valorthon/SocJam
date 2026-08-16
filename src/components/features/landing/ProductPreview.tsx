import { Check, ChevronRight, CircleCheck, Sparkles } from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";

import { BrandMark } from "./BrandMark";

const platforms = [
  {
    name: "LinkedIn",
    Icon: FaLinkedinIn,
    className: "bg-[#0a66c2] text-white",
  },
  {
    name: "Instagram",
    Icon: FaInstagram,
    className:
      "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white",
  },
  {
    name: "X / Twitter",
    Icon: FaXTwitter,
    className: "bg-white text-black",
  },
  {
    name: "Facebook",
    Icon: FaFacebookF,
    className: "bg-[#1877f2] text-white",
  },
  {
    name: "TikTok",
    Icon: FaTiktok,
    className: "bg-white text-black",
  },
];

export function ProductPreview() {
  return (
    <div className="mx-auto mt-14 max-w-5xl sm:mt-16">
      <div className="rounded-xl border border-white/[0.13] bg-[#111114] p-1.5 shadow-[0_32px_100px_-35px_rgba(0,0,0,0.95),0_0_80px_-30px_rgba(255,255,255,0.20)]">
        <div className="overflow-hidden rounded-[7px] border border-white/[0.07] bg-[#0c0c0e]">
          <div className="flex h-10 items-center border-b border-white/[0.07] px-3 sm:px-4">
            <div className="flex gap-1.5">
              <span className="size-2 rounded-full bg-white/15" />
              <span className="size-2 rounded-full bg-white/15" />
              <span className="size-2 rounded-full bg-white/15" />
            </div>
            <div className="mx-auto hidden rounded bg-white/[0.045] px-16 py-1 font-mono text-[9px] text-muted-foreground sm:block">
              socjam.up.railway.app/compose
            </div>
          </div>
          <div className="grid min-h-[300px] sm:min-h-[390px] md:grid-cols-[144px_1fr]">
            <aside className="hidden border-r border-white/[0.07] p-3 md:block">
              <div className="px-2">
                <BrandMark />
              </div>
              <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
                <p className="rounded bg-white/[0.07] px-2.5 py-2 text-foreground">
                  ✦ &nbsp; Compose
                </p>
                <p className="px-2.5 py-2">⊞ &nbsp; Dashboard</p>
                <p className="px-2.5 py-2">◫ &nbsp; Calendar</p>
                <p className="px-2.5 py-2">◌ &nbsp; Analytics</p>
              </div>
            </aside>
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    New post
                  </p>
                  <h3 className="mt-1 text-lg font-medium tracking-tight sm:text-xl">
                    Compose
                  </h3>
                </div>
                <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  Saved just now
                </span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-white/[0.09] bg-white/[0.025] p-4">
                  <p className="text-xs leading-5 text-white/80 sm:text-sm">
                    The next chapter is here. Built with focus, made to move fast,
                    and ready for what&apos;s next. ✦
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3">
                    <div className="flex gap-2 text-muted-foreground">
                      <span>⌁</span>
                      <span>◉</span>
                      <span>☺</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      104 / 2,200
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.09] bg-white/[0.025] p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Adapting for
                    </p>
                    <Sparkles className="size-3.5 text-white/70" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {platforms.slice(0, 3).map(({ Icon, className, name }) => (
                      <div
                        key={name}
                        className="flex items-center gap-2 rounded-md bg-white/[0.04] p-2"
                      >
                        <span
                          className={`grid size-5 place-items-center rounded ${className}`}
                        >
                          <Icon className="size-3" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-[10px] text-white/75">
                          {name}
                        </span>
                        <CircleCheck className="ml-auto size-3.5 text-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-1.5">
                  {platforms.map(({ Icon, className, name }) => (
                    <span
                      key={name}
                      aria-label={name}
                      className={`grid size-6 place-items-center rounded-full border-2 border-[#0c0c0e] ${className}`}
                    >
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background">
                  Publish now <ChevronRight className="size-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="size-3 text-emerald-400" /> Platform-native versions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="size-3 text-emerald-400" /> One clear status view
        </span>
      </div>
    </div>
  );
}
