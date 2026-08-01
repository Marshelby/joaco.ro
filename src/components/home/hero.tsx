import Image from "next/image";

type HeroProps = {
  image: { src: string; alt: string };
  title: string;
  description: string;
};

export function Hero({ image, title, description }: HeroProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="hero-title">
      <div className="relative lg:min-h-[30rem]">
        <div className="absolute inset-0 hidden lg:block" aria-hidden="true">
          <Image src={image.src} alt="" fill priority quality={85} sizes="(min-width: 1280px) 75rem, (min-width: 1024px) calc(100vw - 4rem), 100vw" className="object-cover object-[68%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/5" />
        </div>
        <div className="relative aspect-[16/10] overflow-hidden lg:hidden">
          <Image src={image.src} alt={image.alt} fill priority quality={85} sizes="100vw" className="object-cover object-[68%_center]" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-9 lg:min-h-[22rem] lg:w-[56%] lg:px-14 lg:py-16">
          <h1 id="hero-title" className="max-w-xl whitespace-pre-line text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
        </div>
      </div>
    </section>
  );
}
