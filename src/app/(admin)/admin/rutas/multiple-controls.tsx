"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { operarRutaMultiple } from "./multiple-actions";
import type { SolicitudRutaMultiple } from "./multiple-types";

type Comando = Omit<SolicitudRutaMultiple, "clave">;
export function RutaMultipleForm({ comando, children, etiqueta, disabled = false, editarBloqueado = false, validarFormulario = false }: {
  comando: Comando; children?: ReactNode; etiqueta: string; disabled?: boolean; editarBloqueado?: boolean; validarFormulario?: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [valido, setValido] = useState(!validarFormulario);
  const [error, setError] = useState("");
  const [incierta, setIncierta] = useState(false);
  const solicitud = useRef<SolicitudRutaMultiple | null>(null);
  const bloqueo = useRef(false);
  return <form className="space-y-3" onChange={e => { if (validarFormulario) setValido(e.currentTarget.checkValidity()); }} onSubmit={e => {
    e.preventDefault();
    if (bloqueo.current || disabled) return;
    if (document.querySelector('[data-preparacion-pendiente="true"]')) { setError("Guarda o cancela las cantidades en edición antes de continuar."); return; }
    if (!solicitud.current) {
      const f = new FormData(e.currentTarget);
      solicitud.current = { ...comando, ruta: comando.ruta || crypto.randomUUID(), clave: crypto.randomUUID(),
        ...(f.has("nombre") ? { nombre: String(f.get("nombre")) } : {}),
        ...(f.has("seleccionPedidos") ? { pedidos: f.getAll("pedidos").map(String) } : {}),
        ...(f.has("seleccionRepartidores") ? { repartidores: f.getAll("repartidores").map(String) } : {}),
        ...(f.has("motivo") ? { motivo: String(f.get("motivo")) } : {}),
      };
    }
    bloqueo.current = true;
    iniciar(async () => {
      try {
        const r = await operarRutaMultiple(solicitud.current!);
        if (r.error) { setError(r.error); setIncierta(true); return; }
        solicitud.current = null; setIncierta(false); setError(""); router.refresh();
      } catch { setError("Respuesta no recibida. Reintenta la misma solicitud."); setIncierta(true); }
      finally { bloqueo.current = false; }
    });
  }}>
    <fieldset disabled={(!editarBloqueado && disabled) || pendiente || incierta} className="min-w-0 space-y-3">{children}</fieldset>
    <div className="flex flex-wrap gap-2"><Button type="submit" className="h-auto min-h-11 whitespace-normal" disabled={disabled || pendiente || !valido}>{pendiente ? "Procesando…" : incierta ? "Reintentar la misma solicitud" : etiqueta}</Button>
      {incierta && <Button type="button" variant="secondary" disabled={pendiente} onClick={() => { solicitud.current = null; setIncierta(false); setError(""); router.refresh(); }}>Consultar estado actualizado</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
