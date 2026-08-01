import Image from "next/image";
import {
  BedDouble,
  Boxes,
  Computer,
  Container,
  CookingPot,
  Flower2,
  Gamepad2,
  House,
  Lamp,
  PawPrint,
  Shirt,
  SprayCan,
  SunMedium,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ImageAsset, ImageFallbackKind } from "@/types/media";

const fallbackVisuals: Record<ImageFallbackKind, { icon: LucideIcon; className: string }> = {
  cookware: { icon: CookingPot, className: "bg-orange-100 text-orange-800 dark:bg-orange-950/45 dark:text-orange-200" },
  thermos: { icon: Container, className: "bg-sky-100 text-sky-800 dark:bg-sky-950/45 dark:text-sky-200" },
  bedding: { icon: BedDouble, className: "bg-violet-100 text-violet-800 dark:bg-violet-950/45 dark:text-violet-200" },
  pillow: { icon: Shirt, className: "bg-rose-100 text-rose-800 dark:bg-rose-950/45 dark:text-rose-200" },
  lighting: { icon: Lamp, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200" },
  organization: { icon: Boxes, className: "bg-teal-100 text-teal-800 dark:bg-teal-950/45 dark:text-teal-200" },
  cleaning: { icon: SprayCan, className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/45 dark:text-cyan-200" },
  toys: { icon: Gamepad2, className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/45 dark:text-fuchsia-200" },
  storage: { icon: Container, className: "bg-blue-100 text-blue-800 dark:bg-blue-950/45 dark:text-blue-200" },
  tools: { icon: Wrench, className: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100" },
  pets: { icon: PawPrint, className: "bg-lime-100 text-lime-800 dark:bg-lime-950/45 dark:text-lime-200" },
  garden: { icon: Flower2, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200" },
  home: { icon: House, className: "bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-200" },
  technology: { icon: Computer, className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-200" },
  seasonal: { icon: SunMedium, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-200" },
};

type CatalogImageProps = {
  image?: ImageAsset;
  fallback: ImageFallbackKind;
  sizes: string;
  priority?: boolean;
  className?: string;
  fallbackIconClassName?: string;
};

export function CatalogImage({
  image,
  fallback,
  sizes,
  priority = false,
  className,
  fallbackIconClassName,
}: CatalogImageProps) {
  if (image) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        className={cn(image.fit === "contain" ? "object-contain" : "object-cover", className)}
      />
    );
  }

  const visual = fallbackVisuals[fallback];
  const Icon = visual.icon;

  return (
    <div className={cn("flex size-full items-center justify-center", visual.className)} aria-hidden="true">
      <Icon className={cn("size-12 stroke-[1.4] sm:size-16", fallbackIconClassName)} />
    </div>
  );
}
