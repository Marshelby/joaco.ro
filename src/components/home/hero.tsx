import Image from "next/image";

import { BRAND } from "@/config/brand";

type HeroProps = {
  image: { src: string; alt: string };
};

export function Hero({ image }: HeroProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label={`Portada de ${BRAND.name}`}>
      <div className="relative aspect-[2/3]">
        <Image src={image.src} alt={image.alt} fill priority quality={85} sizes="(min-width: 1280px) 75rem, (min-width: 1024px) calc(100vw - 4rem), 100vw" className="object-contain" />
      </div>
    </section>
  );
}
