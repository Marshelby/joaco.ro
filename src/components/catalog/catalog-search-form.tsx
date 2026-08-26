"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { usePublicNavigationFeedback } from "@/components/navigation/public-navigation-feedback";
import { Button } from "@/components/ui/button";
import { getCatalogHref, type CatalogSort } from "@/lib/catalog";

type CatalogSearchFormProps = {
  mode: "submit-only" | "live";
  initialQuery?: string;
  category?: string;
  sort?: CatalogSort;
  variant: "home" | "toolbar";
  placeholder?: string;
};

const LIVE_SEARCH_DEBOUNCE_MS = 250;

export function CatalogSearchForm({
  mode,
  initialQuery = "",
  category,
  sort,
  variant,
  placeholder = "Busca frutas, verduras, hidropónicos y más",
}: CatalogSearchFormProps) {
  const router = useRouter();
  const feedback = usePublicNavigationFeedback();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestRef = useRef<string | null>(null);
  const awaitingLatestRequestRef = useRef(false);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (mode !== "live") return;

    const queryFromUrl = initialQuery.trim();
    if (queryFromUrl === latestRequestRef.current) {
      awaitingLatestRequestRef.current = false;
      return;
    }

    if (!awaitingLatestRequestRef.current && queryFromUrl !== queryRef.current.trim()) {
      setQuery(queryFromUrl);
    }
  }, [initialQuery, mode]);

  useEffect(() => {
    if (!isPending && awaitingLatestRequestRef.current && latestRequestRef.current === initialQuery.trim()) {
      awaitingLatestRequestRef.current = false;
    }
  }, [initialQuery, isPending]);

  const cancelDebounce = useCallback(() => {
    if (!debounceRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const getHref = useCallback((value: string) => getCatalogHref({ query: value, category, sort }), [category, sort]);

  const searchNow = useCallback((value: string, explicit: boolean) => {
    const normalizedQuery = value.trim();
    const href = getHref(normalizedQuery);

    if (mode === "submit-only") {
      feedback?.beginNavigation(href);
      router.push(href);
      return;
    }

    if (normalizedQuery === latestRequestRef.current && awaitingLatestRequestRef.current) return;
    if (normalizedQuery === initialQuery.trim() && !awaitingLatestRequestRef.current) return;

    latestRequestRef.current = normalizedQuery;
    awaitingLatestRequestRef.current = true;
    if (explicit) feedback?.beginNavigation(href);
    startTransition(() => router.replace(href, { scroll: false }));
  }, [feedback, getHref, initialQuery, mode, router, startTransition]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (mode !== "live" || normalizedQuery === initialQuery.trim()) return;
    if (normalizedQuery === latestRequestRef.current && awaitingLatestRequestRef.current) return;

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      searchNow(query, false);
    }, LIVE_SEARCH_DEBOUNCE_MS);

    return cancelDebounce;
  }, [cancelDebounce, initialQuery, mode, query, searchNow]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelDebounce();
    searchNow(query, true);
  }

  function clearSearch() {
    cancelDebounce();
    setQuery("");
    searchNow("", true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const isHome = variant === "home";

  return (
    <form
      action="/catalogo"
      role="search"
      aria-busy={isPending || undefined}
      className={isHome ? "flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:gap-3 sm:p-4" : "flex min-w-0 flex-1 gap-2"}
      onSubmit={submit}
    >
      {category ? <input type="hidden" name="categoria" value={category} /> : null}
      {sort && sort !== "recommended" ? <input type="hidden" name="orden" value={sort} /> : null}
      <label className="sr-only" htmlFor={`catalog-search-${variant}`}>Buscar productos</label>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          id={`catalog-search-${variant}`}
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {query ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={clearSearch}
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-[background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-muted hover:text-foreground active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Button type="submit" className={isHome ? "w-full sm:w-auto" : undefined} aria-label={isPending ? "Actualizando resultados" : undefined}>
        {isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        Buscar
      </Button>
    </form>
  );
}
