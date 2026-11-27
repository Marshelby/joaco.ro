"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, X } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";
import { guardarDatosFacturacion } from "@/app/(admin)/admin/clientes/facturacion-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { camposFacturacion, type DatosFacturacion } from "@/lib/admin/cliente-facturacion";
import { ciudadesYLocalidadesValparaiso, comunasValparaiso } from "@/lib/admin/geografia-facturacion";

function SelectorGeografico({ nombre, etiqueta, valor }: {
  nombre: "comuna" | "ciudad";
  etiqueta: string;
  valor: string | null;
}) {
  const id = useId();
  const catalogo = nombre === "comuna" ? comunasValparaiso : ciudadesYLocalidadesValparaiso;
  const historico = valor && !catalogo.includes(valor) ? valor : null;
  const opciones = historico ? [historico, ...catalogo] : catalogo;

  return (
    <div className="min-w-0 text-sm font-medium">
      <Combobox.Root
        name={nombre}
        items={opciones}
        defaultValue={valor}
        openOnInputClick
        locale="es-CL"
      >
        <label htmlFor={id}>{etiqueta}</label>
        <Combobox.InputGroup className="mt-1 flex h-10 items-center rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50">
          <Combobox.Input id={id} placeholder="Buscar…" className="min-w-0 flex-1 bg-transparent pl-3 outline-none" />
          <Combobox.Clear type="button" aria-label={`Quitar ${etiqueta.toLowerCase()}`} className="p-2">
            <X className="size-4" aria-hidden="true" />
          </Combobox.Clear>
          <Combobox.Trigger type="button" aria-label={`Mostrar opciones de ${etiqueta.toLowerCase()}`} className="p-2">
            <ChevronDown className="size-4" aria-hidden="true" />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className="z-[60] w-(--anchor-width)">
            <Combobox.Popup className="rounded-lg border bg-card shadow-lg">
              <Combobox.Empty className="px-3 py-2 text-muted-foreground">Sin coincidencias</Combobox.Empty>
              <Combobox.List className="max-h-[min(14rem,var(--available-height))] overflow-y-auto overscroll-contain">
                {(opcion: string) => (
                  <Combobox.Item key={opcion} value={opcion} className="cursor-default px-3 py-2 wrap-anywhere data-highlighted:bg-muted data-selected:font-semibold">
                    {opcion}{opcion === historico && <span className="ml-1 text-muted-foreground">(valor histórico)</span>}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

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
                      <dd className="wrap-anywhere text-sm font-medium">{datos?.[nombre] || "Sin dato"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex justify-end">
                  <Dialog.Close type="button" className={buttonVariants({ variant: "outline" })}>Cerrar</Dialog.Close>
                </div>
              </>
            ) : (
              <form onSubmit={guardar} className="space-y-4">
                <p className="text-sm text-muted-foreground">Completa al menos un campo.</p>
                <fieldset disabled={pendiente} className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {camposFacturacion.map(({ nombre, etiqueta, maximo }) => nombre === "comuna" || nombre === "ciudad" ? (
                    <SelectorGeografico key={nombre} nombre={nombre} etiqueta={nombre === "ciudad" ? "Ciudad o localidad" : etiqueta} valor={datos?.[nombre] ?? null} />
                  ) : (
                    <label key={nombre} className={nombre === "direccion_tributaria" || nombre === "correo_facturacion" ? "block min-w-0 text-sm font-medium sm:col-span-2" : "block min-w-0 text-sm font-medium"}>
                      {etiqueta}
                      <input name={nombre} type={nombre === "correo_facturacion" ? "email" : "text"}
                        defaultValue={datos?.[nombre] ?? ""} maxLength={maximo}
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
