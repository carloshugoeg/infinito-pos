import { describe, expect, it } from "vitest";
import { resolveIngredientIcon } from "@/lib/ingredient-icon";

/** Map an ingredient name to the resolved icon's displayName. */
function iconFor(name: string) {
  return resolveIngredientIcon(name).displayName;
}

describe("resolveIngredientIcon — real Infinito catalog", () => {
  const cases: Array<[name: string, icon: string]> = [
    // Packaging / disposables
    ["Vaso 12oz", "CupSoda"],
    ["Tenedor", "Fork"],
    ["Servilleta", "Napkin"],
    ["Tapadera", "CupLid"],
    ["Porta vasos", "CupCarrier"],
    ["Souffle de chocolate con tapa", "Ramekin"],
    // Fruit / dairy / purchased
    ["Fresa", "Strawberry"],
    ["Leche condensada", "Milk"],
    ["Nutella", "SpreadJar"],
    ["Yogurt natural", "YogurtCup"],
    ["Ferrero", "ChocolateTruffle"],
    ["Galleta Oreo entera", "Cookie"],
    ["Galleta Lotus entera", "Biscuit"],
    // Toppings
    ["Topping Oreo", "Cookie"],
    ["Topping Lotus", "Biscuit"],
    ["Topping Almendra", "Nut"],
    ["Topping Coco", "Coconut"],
    ["Topping Pistacho", "Pistachio"],
    ["Topping Yogurt", "YogurtCup"],
    // Prepared bases — flavour beats texture, and "chocolate" beats "leche"
    ["Crema", "CreamDollop"],
    ["Chocolate con leche (cobertura)", "ChocolateBar"],
    ["Chocolate blanco (cobertura)", "ChocolateBar"],
    ["Crema Lotus", "Biscuit"],
    ["Crema Rafaello", "Coconut"]
  ];

  it.each(cases)("%s -> %s", (name, icon) => {
    expect(iconFor(name)).toBe(icon);
  });

  it("covers every catalog ingredient without falling back", () => {
    for (const [name] of cases) {
      expect(iconFor(name)).not.toBe("Dessert");
    }
  });
});

describe("resolveIngredientIcon — demo catalog & edge cases", () => {
  const cases: Array<[name: string, icon: string]> = [
    ["Mango", "Mango"],
    ["Malvavisco", "Marshmallow"],
    ["Jalea de mango", "JamJar"],
    ["Jalea de fresa", "JamJar"],
    ["Mania", "Nut"],
    ["Caja grande", "Package"],
    ["Vaso pequeno", "CupSoda"],
    ["Chocolate oscuro", "ChocolateBar"],
    ["Pistacho", "Pistachio"],
    ["Almendra", "Nut"],
    ["Oreo", "Cookie"],
    ["Lotus", "Biscuit"],
    ["Coco", "Coconut"]
  ];

  it.each(cases)("%s -> %s", (name, icon) => {
    expect(iconFor(name)).toBe(icon);
  });

  it("is accent- and case-insensitive", () => {
    expect(iconFor("FRESA")).toBe("Strawberry");
    expect(iconFor("Maní")).toBe("Nut");
  });

  it("falls back to a neutral dessert glyph for unknown ingredients", () => {
    expect(iconFor("Ingrediente misterioso")).toBe("Dessert");
  });
});
