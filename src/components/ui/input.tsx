import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "touch-target w-full rounded-[1.2rem] border border-transparent bg-[var(--field)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:bg-white focus:ring-4 focus:ring-[rgba(255,151,102,0.18)]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
