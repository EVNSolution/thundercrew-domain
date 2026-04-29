import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneMap = {
  active: "badge-active",
  muted: "badge-muted",
  outline: "badge-outline",
  default: ""
} as const;

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: keyof typeof toneMap }) {
  return <span className={cn("badge", toneMap[tone])}>{children}</span>;
}
