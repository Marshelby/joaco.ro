"use client";

import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { cargarPosibleParaPedido } from "@/app/(admin)/admin/posibles-pedidos/precarga-actions";
import { OrderCustomerSelection } from "@/components/admin/order-customer-selection";
import { OrderWizard } from "@/components/admin/order-wizard";
import { buttonVariants } from "@/components/ui/button";

export function PossibleOrderCreate({ id, version }: { id: string; version: number }) {
  const titulo = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const carga = useRef(0);
  const [precarga, setPrecarga] = useState<Awaited<ReturnType<typeof cargarPosibleParaPedido>> | null>(null);
  const [error, setError] = useState("");
  const [bloqueado, setBloqueado] = useState(false);

  async function cargar() {
    const intento = ++carga.current;
    setError("");
    try {
      const datos = await cargarPosibleParaPedido(id, version);
      if (intento === carga.current) setPrecarga(datos);
    } catch {
      if (intento === carga.current) setError("No se pudo cargar la solicitud. Si cambió, actualiza la página.");
    }
  }

  return <>
    <button type="button" className={buttonVariants()} onClick={() => {
      dialogo.current?.showModal();
      void cargar();
    }}>Crear pedido</button>
    <dialog ref={dialogo} aria-labelledby={titulo}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-4xl overflow-y-auto rounded-2xl border bg-background p-4 text-foreground backdrop:bg-black/50 sm:p-6"
      onCancel={(event) => { if (bloqueado) event.preventDefault(); }}
      onClose={() => {
        carga.current += 1;
        setPrecarga(null);
        setError("");
      }}>
      <header className="mb-4 flex items-center justify-between gap-4">
        <h2 id={titulo} className="text-lg font-semibold">Crear pedido</h2>
        <button type="button" aria-label="Cerrar" disabled={bloqueado}
          className={buttonVariants({ variant: "ghost" })} onClick={() => dialogo.current?.close()}>
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>
      {precarga ? <>
        <p className="mb-4 text-sm text-muted-foreground">Al confirmar, se crea el pedido y la solicitud queda abierta y sin vínculo.</p>
        <OrderWizard alBloquear={setBloqueado}>
          <OrderCustomerSelection inicial={precarga.inicial} solicitud={precarga} />
        </OrderWizard>
      </> : error ? <div className="space-y-3">
        <p role="alert">{error}</p>
        <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => void cargar()}>Reintentar</button>
      </div> : <p role="status">Cargando solicitud…</p>}
    </dialog>
  </>;
}
