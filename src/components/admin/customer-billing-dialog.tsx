"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, useTransition, type FormEvent } from "react";
import { guardarDatosFacturacion } from "@/app/(admin)/admin/clientes/facturacion-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { camposFacturacion, type DatosFacturacion } from "@/lib/admin/cliente-facturacion";

export function CustomerBillingDialog({ clienteId, datos, readOnly }: {
  clienteId: string;
  datos: DatosFacturacion | null;
  readOnly: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, iniciar] = useTransition();
  const titulo = readOnly ? "Ver datos de factura" : datos ? "Editar datos de factura" : "Agregar datos de factura";

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente || readOnly) return;
    const formulario = new FormData(evento.currentTarget);
    setError("");
    iniciar(async () => {
      try {
        const resultado = await guardarDatosFacturacion(clienteId, formulario);
        if (resultado.error) setError(resultado.error);
        else setAbierta(false);
      } catch {
        setError("No se pudo confirmar el guardado. Vuelve a intentar.");
      }
    });
  }

  if (readOnly && !datos) return null;

  return (
    <Dialog.Root open={abierta} onOpenChange={(valor) => {
      if (pendiente) return;
      setError("");
      setAbierta(valor);
    }}>
      <Dialog.Trigger type="button" className={buttonVariants({ variant: "outline" })}>{titulo}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="motion-dialog-content max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl outline-none sm:p-5" aria-busy={pendiente}>
            <Dialog.Title className="mb-4 text-lg font-semibold tracking-tight">{titulo}</Dialog.Title>
            {readOnly ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {camposFacturacion.map(({ nombre, etiqueta }) => (
                    <div key={nombre} className="min-w-0">
                      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
                      <dd className="wrap-anywhere text-sm font-medium">{datos?.[nombre]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex justify-end">
                  <Dialog.Close type="button" className={buttonVariants({ variant: "outline" })}>Cerrar</Dialog.Close>
                </div>
              </>
            ) : (
              <form onSubmit={guardar} className="space-y-4">
                <fieldset disabled={pendiente} className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {camposFacturacion.map(({ nombre, etiqueta, maximo }) => (
                    <label key={nombre} className={nombre === "direccion_tributaria" || nombre === "correo_facturacion" ? "block min-w-0 text-sm font-medium sm:col-span-2" : "block min-w-0 text-sm font-medium"}>
                      {etiqueta}
                      <input name={nombre} type={nombre === "correo_facturacion" ? "email" : "text"}
                        defaultValue={datos?.[nombre]} required maxLength={maximo}
                        className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
                    </label>
                  ))}
                </fieldset>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Dialog.Close type="button" disabled={pendiente} className={buttonVariants({ variant: "outline" })}>Cancelar</Dialog.Close>
                  <Button type="submit" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar datos"}</Button>
                </div>
              </form>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
