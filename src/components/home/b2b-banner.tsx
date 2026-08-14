import { getImageProps } from "next/image";

export function B2bBanner() {
  const common = {
    alt: "Hidro Leufú, productos hidropónicos y frescos para empresas",
    fetchPriority: "high" as const,
    sizes: "(min-width: 1280px) 1216px, (min-width: 1024px) calc(100vw - 4rem), (min-width: 768px) calc(100vw - 3rem), calc(100vw - 2rem)",
  };
  const { props: { srcSet: desktopSrcSet } } = getImageProps({
    ...common,
    src: "/images/hero/banner.webp",
    width: 1774,
    height: 887,
  });
  const { props: { srcSet: mobileSrcSet, ...mobileImageProps } } = getImageProps({
    ...common,
    src: "/images/hero/bannercelular.webp",
    width: 1024,
    height: 1536,
  });

  return (
    <section aria-label="Hidro Leufú para empresas">
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} sizes={common.sizes} />
        <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes={common.sizes} />
        <img {...mobileImageProps} alt={common.alt} className="h-auto w-full rounded-2xl border border-border/70 shadow-sm" />
      </picture>
    </section>
  );
}
