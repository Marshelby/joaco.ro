"use client";

import { ChevronLeft, ChevronRight, Sparkles, Tags, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProductCard } from "@/components/home/product-card";
import type { MockProduct } from "@/types/product";

type ProductRailIcon = "best-sellers" | "opportunities" | "new-arrivals";

const railIcons = {
  "best-sellers": TrendingUp,
  opportunities: Tags,
  "new-arrivals": Sparkles,
};

type ProductRailProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  icon: ProductRailIcon;
  products: readonly MockProduct[];
  ariaLabel: string;
};

export function ProductRail({ id, eyebrow, title, description, icon, products, ariaLabel }: ProductRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollBackward, setCanScrollBackward] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const Icon = railIcons[icon];

  const updateControls = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    setCanScrollBackward(rail.scrollLeft > 1);
    setCanScrollForward(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateControls();
    window.addEventListener("resize", updateControls);
    return () => window.removeEventListener("resize", updateControls);
  }, [updateControls, products.length]);

  const scroll = (direction: "backward" | "forward") => {
    const rail = railRef.current;
    if (!rail) return;

    const distance = rail.clientWidth * 0.86;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction === "forward" ? distance : -distance,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section aria-labelledby={id} className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div id={id} className="min-w-0">
          {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
          </div>
          {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-label={`Ver productos anteriores de ${title}`}
            aria-controls={`${id}-rail`}
            disabled={!canScrollBackward}
            onClick={() => scroll("backward")}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Ver más productos de ${title}`}
            aria-controls={`${id}-rail`}
            disabled={!canScrollForward}
            onClick={() => scroll("forward")}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        id={`${id}-rail`}
        ref={railRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={updateControls}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scroll("backward");
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            scroll("forward");
          }
        }}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-4 pb-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[23.5%]">
            <ProductCard product={product} variant="rail" />
          </div>
        ))}
      </div>
    </section>
  );
}
