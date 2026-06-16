import { Cookie, CupSoda, Dessert, type LucideIcon, Milk, Nut, Package } from "lucide-react";
import {
  BiscuitGlyph,
  ChocolateBarGlyph,
  ChocolateTruffleGlyph,
  CoconutGlyph,
  CreamDollopGlyph,
  CupCarrierGlyph,
  CupLidGlyph,
  ForkGlyph,
  JamJarGlyph,
  MangoGlyph,
  MarshmallowGlyph,
  NapkinGlyph,
  PistachioGlyph,
  RamekinGlyph,
  SpreadJarGlyph,
  StrawberryGlyph,
  YogurtCupGlyph
} from "@/components/icons/ingredient-glyphs";
import { normalizeText } from "@/lib/utils";

/**
 * Ordered keyword rules mapping an ingredient name to a lucide or custom glyph.
 * Order matters — list the most specific keyword first so e.g. "porta vaso"
 * wins over "vaso", "galleta lotus" resolves as a biscuit (not a generic
 * cookie), and a flavoured "crema lotus" shows the Lotus biscuit rather than the
 * generic cream dollop. The first rule whose keyword appears in the (accent-
 * stripped, lowercased) name wins.
 */
const RULES: Array<[keywords: string[], icon: LucideIcon]> = [
  [["porta vaso", "portavaso"], CupCarrierGlyph],
  [["souffle", "sufle", "souflé"], RamekinGlyph],
  [["servilleta"], NapkinGlyph],
  [["tenedor"], ForkGlyph],
  [["tapadera", "tapa"], CupLidGlyph],
  [["caja"], Package],
  [["nutella"], SpreadJarGlyph],
  [["ferrero"], ChocolateTruffleGlyph],
  [["rafaello", "raffaello", "raffaelo"], CoconutGlyph],
  [["coco", "coconut"], CoconutGlyph],
  [["lotus"], BiscuitGlyph],
  [["oreo"], Cookie],
  [["galleta"], Cookie],
  [["jalea", "mermelada", "jam"], JamJarGlyph],
  [["fresa", "frutilla"], StrawberryGlyph],
  [["mango"], MangoGlyph],
  [["malvavisco", "marshmallow"], MarshmallowGlyph],
  [["yogur"], YogurtCupGlyph],
  // "chocolate" must beat "leche" so "Chocolate con leche" is a bar, not milk.
  [["chocolate"], ChocolateBarGlyph],
  [["leche"], Milk],
  [["almendra", "almond"], Nut],
  [["pistacho", "pistache", "pistachio"], PistachioGlyph],
  [["mani", "cacahuat", "peanut"], Nut],
  [["crema", "cream"], CreamDollopGlyph],
  [["vaso"], CupSoda]
];

/**
 * Resolve an ingredient name to its icon. Unmatched names fall back to a neutral
 * dessert glyph so the UI never renders empty.
 */
export function resolveIngredientIcon(name: string): LucideIcon {
  const normalized = normalizeText(name);
  for (const [keywords, icon] of RULES) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return icon;
    }
  }
  return Dessert;
}
