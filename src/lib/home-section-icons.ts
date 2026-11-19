import { Leaf, ShoppingBasket, Sparkles, Star } from "lucide-react";

export const HOME_SECTION_ICONS = {
  estrella: { label: "Estrella", Icon: Star },
  hoja: { label: "Hoja", Icon: Leaf },
  canasta: { label: "Canasta", Icon: ShoppingBasket },
  destellos: { label: "Destellos", Icon: Sparkles },
} as const;

export type HomeSectionIcon = keyof typeof HOME_SECTION_ICONS;

export function isHomeSectionIcon(value: string): value is HomeSectionIcon {
  return Object.hasOwn(HOME_SECTION_ICONS, value);
}
