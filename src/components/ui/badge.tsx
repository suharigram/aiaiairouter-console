import type * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "danger" | "outline" }) {
  const styles = {
    default: "bg-stone-100 text-stone-700 border-stone-200",
    success: "bg-teal-50 text-teal-700 border-teal-200",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800",
    danger: "bg-red-950/40 text-red-300 border-red-800",
    outline: "bg-stone-100 text-stone-600 border-stone-200",
  };
  return <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium", styles[variant], className)} {...props} />;
}
