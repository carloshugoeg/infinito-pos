import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex touch-target items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-bold transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:brightness-110",
        secondary: "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]",
        ghost: "bg-transparent hover:bg-[var(--muted)] text-[var(--foreground)]",
        danger: "bg-[var(--danger)] text-white hover:brightness-110",
        outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]"
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3",
        lg: "h-14 px-8 text-base",
        icon: "h-11 w-11 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
