import type * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "error" | "success" }) {
  return <div role={variant === "error" ? "alert" : "status"} className={cn("rounded-sm border px-4 py-3 text-xs leading-relaxed", variant === "error" ? "border-red-800 bg-red-950/40 text-red-300" : variant === "success" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-stone-200 bg-stone-100 text-stone-600", className)} {...props} />;
}
