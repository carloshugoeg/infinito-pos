import { createLucideIcon, type IconNode } from "lucide-react";

/**
 * Custom ingredient glyphs drawn in lucide's exact spec (24x24 grid, 2px stroke,
 * round caps/joins, no fills, `currentColor`) for ingredients the lucide library
 * does not cover. Authored via lucide's own `createLucideIcon` so they reuse the
 * same render pipeline as the rest of the app's icons and are visually
 * indistinguishable from them.
 *
 * Branded ingredients (Nutella, Ferrero, Lotus, Oreo, Rafaello) are intentionally
 * drawn as GENERIC food forms — a spread jar, a wrapped truffle, a biscuit, a
 * sandwich cookie, a coconut — never trademarked logos or marks.
 */

// Fresa / strawberry — body, stem, two calyx leaves, seeds.
export const StrawberryGlyph = createLucideIcon("Strawberry", [
  ["path", { d: "M12 21c2.8 0 6-3.6 6-7.6 0-3-2.4-5.4-6-5.4S6 10.4 6 13.4C6 17.4 9.2 21 12 21Z", key: "body" }],
  ["path", { d: "M12 8V4", key: "stem" }],
  ["path", { d: "M12 5C10.6 5 9.3 4.3 8.5 3.2 8.3 4.6 9 6 10.3 6.6", key: "leaf-l" }],
  ["path", { d: "M12 5c1.4 0 2.7-.7 3.5-1.8.2 1.4-.5 2.8-1.8 3.4", key: "leaf-r" }],
  ["path", { d: "M10 12h.01", key: "s1" }],
  ["path", { d: "M14 12h.01", key: "s2" }],
  ["path", { d: "M12 15h.01", key: "s3" }],
  ["path", { d: "M9.5 16h.01", key: "s4" }],
  ["path", { d: "M14.5 16h.01", key: "s5" }],
] satisfies IconNode);

// Nutella / hazelnut spread — generic lidded jar with a label band.
export const SpreadJarGlyph = createLucideIcon("SpreadJar", [
  ["rect", { width: "12", height: "4", x: "6", y: "5", rx: "1", key: "lid" }],
  ["path", { d: "M7 9h10v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9Z", key: "body" }],
  ["path", { d: "M9 13.5h6", key: "label" }],
] satisfies IconNode);

// Yogurt — foil-sealed tub with a content swirl.
export const YogurtCupGlyph = createLucideIcon("YogurtCup", [
  ["path", { d: "M5 8h14", key: "rim" }],
  ["path", { d: "M6.5 8l1 10a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-10", key: "tub" }],
  ["path", { d: "M9 12c1.5 1 4.5 1 6 0", key: "swirl" }],
] satisfies IconNode);

// Ferrero — generic foil-wrapped chocolate truffle (sphere with foil creases).
export const ChocolateTruffleGlyph = createLucideIcon("ChocolateTruffle", [
  ["circle", { cx: "12", cy: "12", r: "7", key: "ball" }],
  ["path", { d: "M12 5v14", key: "c1" }],
  ["path", { d: "M6.5 8.5l11 7", key: "c2" }],
  ["path", { d: "M17.5 8.5l-11 7", key: "c3" }],
] satisfies IconNode);

// Lotus / generic biscuit — rounded rectangle with emboss line and dots.
export const BiscuitGlyph = createLucideIcon("Biscuit", [
  ["rect", { width: "14", height: "10", x: "5", y: "7", rx: "2", key: "body" }],
  ["path", { d: "M8 10h8", key: "emboss" }],
  ["path", { d: "M9 14h.01", key: "d1" }],
  ["path", { d: "M12 14h.01", key: "d2" }],
  ["path", { d: "M15 14h.01", key: "d3" }],
] satisfies IconNode);

// Coco / coconut — half-shell bowl with inner flesh ring and shavings.
export const CoconutGlyph = createLucideIcon("Coconut", [
  ["path", { d: "M4 10h16", key: "rim" }],
  ["path", { d: "M4 10a8 8 0 0 0 16 0", key: "shell" }],
  ["path", { d: "M6.5 10a5.5 5.5 0 0 0 11 0", key: "flesh" }],
  ["path", { d: "M9 6h.01", key: "f1" }],
  ["path", { d: "M12 5h.01", key: "f2" }],
  ["path", { d: "M15 6h.01", key: "f3" }],
] satisfies IconNode);

// Chocolate coverings (con leche / blanco / oscuro) — segmented bar.
export const ChocolateBarGlyph = createLucideIcon("ChocolateBar", [
  ["rect", { width: "12", height: "16", x: "6", y: "4", rx: "2", key: "bar" }],
  ["path", { d: "M12 4v16", key: "v" }],
  ["path", { d: "M6 9.3h12", key: "h1" }],
  ["path", { d: "M6 14.6h12", key: "h2" }],
] satisfies IconNode);

// Crema — whipped cream dollop with a swirl tip.
export const CreamDollopGlyph = createLucideIcon("CreamDollop", [
  ["path", { d: "M5 18a7 7 0 0 1 14 0", key: "mound" }],
  ["path", { d: "M4 18h16", key: "base" }],
  ["path", { d: "M12 11c0-1.5.6-2 .6-3.3C12.6 6.2 11.7 5 10.4 5", key: "swirl" }],
] satisfies IconNode);

// Mango — plump fruit body with a leaf.
export const MangoGlyph = createLucideIcon("Mango", [
  ["path", { d: "M9 8.5C11.5 6 15.5 6 17.5 8.5S19 15 16 17.5 9 19 6.5 16.5 6.5 11 9 8.5Z", key: "body" }],
  ["path", { d: "M14.5 7.5c.3-1.4 1.6-2.4 3-2.2-.2 1.4-1.4 2.4-2.8 2.3", key: "leaf" }],
] satisfies IconNode);

// Malvavisco / marshmallow — soft cylinder.
export const MarshmallowGlyph = createLucideIcon("Marshmallow", [
  ["path", { d: "M6 9v6a6 3 0 0 0 12 0V9", key: "sides" }],
  ["ellipse", { cx: "12", cy: "9", rx: "6", ry: "3", key: "top" }],
] satisfies IconNode);

// Jalea / jam — preserve jar with a fill level.
export const JamJarGlyph = createLucideIcon("JamJar", [
  ["rect", { width: "10", height: "3", x: "7", y: "4", rx: "1", key: "lid" }],
  ["path", { d: "M8 7h8v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7Z", key: "body" }],
  ["path", { d: "M8 12c1.5 1 6.5 1 8 0", key: "fill" }],
] satisfies IconNode);

// Servilleta / napkin — folded cloth square.
export const NapkinGlyph = createLucideIcon("Napkin", [
  ["rect", { width: "14", height: "14", x: "5", y: "5", rx: "1", key: "cloth" }],
  ["path", { d: "M5 5l14 14", key: "f1" }],
  ["path", { d: "M5 11l8 8", key: "f2" }],
  ["path", { d: "M11 5l8 8", key: "f3" }],
] satisfies IconNode);

// Tapadera / cup lid — domed to-go lid with straw hole and skirt.
export const CupLidGlyph = createLucideIcon("CupLid", [
  ["path", { d: "M5 13c0-3 3-5 7-5s7 2 7 5", key: "dome" }],
  ["path", { d: "M4 13h16", key: "rim" }],
  ["path", { d: "M4 13l1 2.5a2 2 0 0 0 1.9 1.3h10.2a2 2 0 0 0 1.9-1.3l1-2.5", key: "skirt" }],
  ["path", { d: "M11.5 6h3l-.8 2h-1.4Z", key: "hole" }],
] satisfies IconNode);

// Porta vasos / cup carrier — tray with two cup holes.
export const CupCarrierGlyph = createLucideIcon("CupCarrier", [
  ["path", { d: "M4 9h16l-1.4 9a2 2 0 0 1-2 1.7H7.4a2 2 0 0 1-2-1.7L4 9Z", key: "tray" }],
  ["circle", { cx: "9.5", cy: "12.5", r: "2", key: "h1" }],
  ["circle", { cx: "14.5", cy: "12.5", r: "2", key: "h2" }],
] satisfies IconNode);

// Souffle de chocolate con tapa — covered ramekin dish.
export const RamekinGlyph = createLucideIcon("Ramekin", [
  ["path", { d: "M5 13c0-2.8 3-5 7-5s7 2.2 7 5", key: "lid" }],
  ["path", { d: "M5 13h14", key: "rim" }],
  ["path", { d: "M12 6v2", key: "knob" }],
  ["path", { d: "M5 13l1.2 4.2A2 2 0 0 0 8.1 19h7.8a2 2 0 0 0 1.9-1.8L19 13", key: "bowl" }],
] satisfies IconNode);

// Tenedor / fork — three tines and a handle.
export const ForkGlyph = createLucideIcon("Fork", [
  ["path", { d: "M8 3v5a3 3 0 0 0 3 3 3 3 0 0 0 3-3V3", key: "head" }],
  ["path", { d: "M11 3v5", key: "tine" }],
  ["path", { d: "M11 11v10", key: "handle" }],
] satisfies IconNode);

// Pistacho / pistachio — oval shell cracked open at the top.
export const PistachioGlyph = createLucideIcon("Pistachio", [
  ["path", { d: "M12 5c3.3 0 5.5 3.4 5.5 7.5S15.3 20 12 20s-5.5-3.4-5.5-7.5S8.7 5 12 5Z", key: "shell" }],
  ["path", { d: "M9.5 6.5C10 8 11 8.6 12 8.6s2-.6 2.5-2.1", key: "crack" }],
  ["path", { d: "M12 8.6v3", key: "nut" }],
] satisfies IconNode);
