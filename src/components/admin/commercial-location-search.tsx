"use client";

import { useEffect, useId, useRef, useState } from "react";

import { campoDireccion } from "@/components/account/address-form-styles";
import type { LocationSearchProvider, LocationSearchResult } from "@/lib/admin/location-search-contract";

type Props = {
  provider?: LocationSearchProvider;
  onSelect: (result: LocationSearchResult) => void;
};

const administrativeProvider: LocationSearchProvider = async (query, { signal }) => {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 12000);
  try {
    const response = await fetch("/api/admin/ubicaciones/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.any([signal, timeout.signal]),
      body: JSON.stringify({ query }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No fue posible buscar. Puedes usar el mapa manual.");
    if (!Array.isArray(body.results)) throw new Error("La respuesta del buscador no es válida. Puedes usar el mapa manual.");
    return body.results;
  } catch (error) {
    if (timeout.signal.aborted && !signal.aborted) throw new Error("La búsqueda tardó demasiado. Intenta nuevamente o usa el mapa manual.");
    throw error;
  } finally { clearTimeout(timer); }
};

export function CommercialLocationSearch({ provider = administrativeProvider, onSelect }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly LocationSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const current = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    const term = query.trim();
    const timer = term.length >= 3 && term.length <= 200 ? setTimeout(async () => {
      if (abort.signal.aborted || current !== request.current) return;
      try {
        const found = await provider(term, { signal: abort.signal });
        if (abort.signal.aborted || current !== request.current) return;
        setResults(found.filter((result) => result.label.trim() && Number.isFinite(result.latitude) && Number.isFinite(result.longitude) && Math.abs(result.latitude) <= 90 && Math.abs(result.longitude) <= 180));
        setStatus("ready");
      } catch (error) {
        if (abort.signal.aborted || current !== request.current) return;
        setResults([]);
        setErrorMessage(error instanceof Error ? error.message : "No fue posible buscar. Puedes usar el mapa manual.");
        setStatus("error");
      }
    }, 400) : undefined;
    return () => {
      clearTimeout(timer);
      abort.abort();
      request.current += 1;
    };
  }, [query, provider]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, id, open]);

  function select(result: LocationSearchResult) {
    request.current += 1;
    controller.current?.abort();
    setOpen(false);
    setActive(-1);
    onSelect(result);
  }

  const expanded = open && results.length > 0;
  return <div className="space-y-2" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <label htmlFor={id} className="text-sm font-medium">Buscar dirección o lugar comercial</label>
    <input id={id} type="text" maxLength={200} role="combobox" autoComplete="off" className={campoDireccion}
      value={query} aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-results`}
      aria-describedby={`${id}-status`} aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
      onFocus={() => setOpen(true)} onChange={(event) => {
        request.current += 1;
        controller.current?.abort();
        setQuery(event.target.value);
        setResults([]);
        setActive(-1);
        setOpen(true);
        setStatus(provider && event.target.value.trim().length >= 3 && event.target.value.trim().length <= 200 ? "searching" : "idle");
      }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
          event.preventDefault();
          setOpen(true);
          setActive((index) => event.key === "ArrowDown" ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1));
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (expanded && active >= 0) select(results[active]);
        }
      }} />
    <p id={`${id}-status`} role="status" aria-live="polite" className="text-sm text-muted-foreground">
      {!provider ? "La búsqueda aún no está disponible. Puedes marcar el punto en el mapa o usar tu ubicación actual." : status === "searching" ? "Buscando…" : status === "error" ? errorMessage : status === "ready" && !results.length ? "Sin resultados. Prueba con otra dirección o lugar." : status === "ready" ? `${results.length} sugerencias disponibles. Usa las flechas y Enter para seleccionar.` : "Escribe al menos 3 caracteres para buscar."}
    </p>
    <ul id={`${id}-results`} role="listbox" aria-label="Direcciones y lugares sugeridos" hidden={!expanded} className="max-h-60 overflow-y-auto rounded-lg border border-border">
      {results.map((result, index) => <li key={`${result.id}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index}
        className={`cursor-pointer px-3 py-3 text-sm ${active === index ? "bg-muted" : ""}`}
        onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => select(result)}>{result.label}</li>)}
    </ul>
    <p className="text-xs text-muted-foreground">Búsqueda proporcionada por <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>.</p>
    <p className="text-xs text-muted-foreground">El resultado solo coloca un punto provisional. Ajusta el marcador y pulsa Confirmar ubicación.</p>
  </div>;
}
