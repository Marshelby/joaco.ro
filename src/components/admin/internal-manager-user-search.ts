import { useEffect } from "react";

export type UsuarioGestorInterno = { usuario_id: string; nombre: string | null; correo: string | null };

type ResultadoBusqueda = { query: string; usuarios: UsuarioGestorInterno[]; error: string };

export function useInternalManagerUserSearch(
  search: string,
  retry: number,
  buscar: (query: string) => Promise<{ usuarios?: UsuarioGestorInterno[]; error?: string }>,
  setResult: (resultado: ResultadoBusqueda) => void,
) {
  useEffect(() => {
    if (search.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await buscar(search);
        if (!cancelled) setResult({ query: search, usuarios: response.usuarios ?? [], error: response.error ?? "" });
      } catch {
        if (!cancelled) setResult({ query: search, usuarios: [], error: "No se pudo buscar usuarios. Revisa tu conexión e intenta nuevamente." });
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, retry, buscar, setResult]);
}
