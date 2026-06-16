import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { resolveIngredientIcon } from "@/lib/ingredient-icon";
import { cn } from "@/lib/utils";

type IngredientIconProps = Omit<LucideProps, "ref"> & {
  /** Ingredient name; the icon is resolved from it by keyword. */
  name: string;
  /** Render inside a muted rounded chip (mirrors the kiosk's letter tiles). */
  chip?: boolean;
};

/**
 * Renders the icon that matches an ingredient name. Server-safe (no hooks), so it
 * can be used directly in the admin server components. The resolved icon is a
 * stable, module-level lucide component, so it is rendered via `createElement`
 * (no per-render component identity is created).
 */
export function IngredientIcon({ name, chip = false, size = 18, className, ...props }: IngredientIconProps) {
  const icon = resolveIngredientIcon(name);

  if (chip) {
    return (
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]",
          className
        )}
      >
        {createElement(icon, { size, "aria-hidden": true, ...props })}
      </span>
    );
  }

  return createElement(icon, {
    size,
    "aria-hidden": true,
    className: cn("shrink-0 text-[var(--primary)]", className),
    ...props
  });
}
