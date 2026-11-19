"use client";

import { Dialog } from "@base-ui/react/dialog";
import { FolderOpen, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { gestionarCategoria, type OperacionCategoria } from "@/app/(admin)/admin/gestor-publico/categorias-actions";
import { Button } from "@/components/ui/button";
import type { CategoriaGestor, ProductoClasificable } from "@/lib/admin/catalogo";
import { normalizeCatalogText } from "@/lib/catalog";

type Clasificacion = { categorias: CategoriaGestor[]; productos: ProductoClasificable[] };
type Modal = { tipo: "editar" | "eliminar"; categoria: CategoriaGestor } | { tipo: "crear" | "asignar" };

const campo = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function cantidadProductos(total: number) {
  return total === 1 ? "1 producto" : `${total} productos`;
}

function version(categoria: CategoriaGestor) {
  return { id: categoria.id, version: categoria.fecha_actualizacion };
}

export function CategoryManagerLoadError() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <p role="alert" className="text-sm text-destructive">No se pudieron cargar las categorías y los productos.</p>
      <Button variant="outline" disabled={pendiente} onClick={() => iniciar(() => router.refresh())}>
        {pendiente ? "Cargando…" : "Reintentar"}
      </Button>
    </div>
  );
}

export function CategoryManager({ categorias, productos }: Clasificacion) {
  const [modal, setModal] = useState<Modal | null>(null);
  const [aviso, setAviso] = useState("");
  const regresarFoco = useRef<HTMLElement | null>(null);
  const botonCrear = useRef<HTMLButtonElement | null>(null);
  const conteos = new Map<string | null, number>();
  for (const producto of productos) {
    conteos.set(producto.categoria_id, (conteos.get(producto.categoria_id) ?? 0) + 1);
  }

  function abrir(nuevo: Modal, disparador: HTMLElement) {
    regresarFoco.current = disparador;
    setAviso("");
    setModal(nuevo);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button ref={botonCrear} onClick={(e) => abrir({ tipo: "crear" }, e.currentTarget)}>
          <Plus aria-hidden="true" /> Nueva categoría
        </Button>
        <Button variant="outline" onClick={(e) => abrir({ tipo: "asignar" }, e.currentTarget)}>
          <FolderOpen aria-hidden="true" /> Productos sin categoría ({conteos.get(null) ?? 0})
        </Button>
      </div>
      <p role="status" className={aviso ? "rounded-lg bg-muted p-3 text-sm" : "sr-only"}>{aviso}</p>
      {categorias.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {categorias.map((categoria) => (
            <li key={categoria.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0 space-y-1">
                <h3 className="break-words font-semibold">{categoria.nombre}</h3>
                {categoria.descripcion && <p className="break-words text-sm text-muted-foreground">{categoria.descripcion}</p>}
                <p className="text-sm text-muted-foreground">
                  {cantidadProductos(conteos.get(categoria.id) ?? 0)} · Orden {categoria.orden} · {categoria.activa ? "Activa" : "Inactiva"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" aria-label={`Editar ${categoria.nombre}`} onClick={(e) => abrir({ tipo: "editar", categoria }, e.currentTarget)}>Editar</Button>
                <Button variant="destructive" aria-label={`Eliminar ${categoria.nombre}`} onClick={(e) => abrir({ tipo: "eliminar", categoria }, e.currentTarget)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Todavía no hay categorías.</p>}
      {modal && (
        <CategoryDialog
          modal={modal}
          categorias={categorias}
          productos={productos}
          cerrar={() => setModal(null)}
          completar={(mensaje) => { setAviso(mensaje); setModal(null); }}
          devolverFoco={() => regresarFoco.current?.isConnected ? regresarFoco.current : botonCrear.current}
        />
      )}
    </section>
  );
}

function CategoryDialog({ modal, cerrar, completar, devolverFoco, ...clasificacion }: Clasificacion & {
  modal: Modal;
  cerrar: () => void;
  completar: (mensaje: string) => void;
  devolverFoco: () => HTMLElement | null;
}) {
  const router = useRouter();
  const idFormulario = useId();
  const [{ categorias, productos }] = useState(clasificacion);
  const enviando = useRef(false);
  const resumenTraslado = useRef<HTMLElement | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");
  const [desactualizado, setDesactualizado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [confirmacion, setConfirmacion] = useState<Extract<OperacionCategoria, { tipo: "guardar" }> | null>(null);
  const categoria = "categoria" in modal ? modal.categoria : null;
  const asignando = modal.tipo === "asignar";
  const eliminando = modal.tipo === "eliminar";
  const nombrePorId = new Map(categorias.map((item) => [item.id, item.nombre]));
  const nombreCategoria = (id: string | null) => id ? nombrePorId.get(id) ?? "Categoría no disponible" : "Sin categoría";
  const vinculados = categoria ? productos.filter((producto) => producto.categoria_id === categoria.id) : [];
  const textoBusqueda = normalizeCatalogText(busqueda);
  const visibles = productos.filter((producto) =>
    (!asignando || producto.categoria_id === null)
    && normalizeCatalogText(`${producto.nombre} ${nombreCategoria(producto.categoria_id)}`).includes(textoBusqueda));
  const traslados = confirmacion
    ? productos.filter((producto) => confirmacion.productos.some((cambio) =>
      cambio.id === producto.id && cambio.origen !== null && !cambio.quitar))
    : [];

  useEffect(() => {
    if (confirmacion) resumenTraslado.current?.focus();
  }, [confirmacion]);

  function cambiarSeleccion(id: string) {
    setSeleccion((anterior) => {
      const siguiente = new Set(anterior);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function ejecutar(operacion: OperacionCategoria) {
    if (enviando.current || desactualizado) return;
    enviando.current = true;
    setError("");
    iniciar(async () => {
      try {
        const resultado = await gestionarCategoria(operacion);
        if (resultado.error) {
          setError(resultado.error);
          setDesactualizado(Boolean(resultado.recargar));
          return;
        }
        const mensaje = operacion.tipo === "eliminar" ? "Categoría eliminada."
          : operacion.tipo === "asignar" ? "Categoría asignada a los productos seleccionados."
            : "Categoría guardada.";
        completar(mensaje);
      } catch {
        setError("No se pudo confirmar la operación. Vuelve a cargar los datos para comprobar el resultado.");
        setDesactualizado(true);
      } finally {
        enviando.current = false;
      }
    });
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (confirmacion) {
      ejecutar(confirmacion);
      return;
    }
    const datos = new FormData(evento.currentTarget);
    if (eliminando && categoria) {
      ejecutar({ tipo: "eliminar", categoria: version(categoria), productos: vinculados.map(({ id, categoria_id }) => ({ id, origen: categoria_id })) });
      return;
    }
    if (asignando) {
      const destino = categorias.find((item) => item.id === datos.get("destino"));
      if (!destino || !seleccion.size) return;
      ejecutar({ tipo: "asignar", categoria: version(destino), productos: [...seleccion].map((id) => ({ id, origen: null })) });
      return;
    }

    const operacion: Extract<OperacionCategoria, { tipo: "guardar" }> = {
      tipo: "guardar",
      categoria: categoria ? version(categoria) : null,
      datos: {
        nombre: String(datos.get("nombre") ?? ""),
        descripcion: String(datos.get("descripcion") ?? ""),
        orden: Number(datos.get("orden")),
        activa: datos.has("activa"),
      },
      productos: productos.filter((producto) => seleccion.has(producto.id)).map((producto) => ({
        id: producto.id,
        origen: producto.categoria_id,
        quitar: categoria && producto.categoria_id === categoria.id ? true : undefined,
      })),
    };
    if (!operacion.datos.nombre.trim()) {
      setError("El nombre de la categoría es obligatorio.");
      return;
    }
    if (operacion.productos.some((cambio) => cambio.origen !== null && !cambio.quitar)) {
      setError("");
      setConfirmacion(operacion);
      return;
    }
    ejecutar(operacion);
  }

  const titulo = eliminando ? "Eliminar categoría" : asignando ? "Productos sin categoría"
    : categoria ? "Editar categoría" : "Nueva categoría";
  const descripcion = eliminando ? "Los productos vinculados quedarán sin categoría y se ocultarán del catálogo hasta que los reasignes a una categoría activa."
    : asignando ? "Selecciona productos y elige la categoría de destino."
      : "Define la visibilidad y el orden de la categoría, y selecciona los productos que quieras añadir o quitar.";

  return (
    <Dialog.Root open onOpenChange={(abierto) => { if (!abierto && !enviando.current) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden p-2 sm:items-center sm:p-4">
          <Dialog.Popup
            aria-busy={pendiente}
            finalFocus={devolverFoco}
            className="motion-dialog-content flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none sm:max-h-[85dvh]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">{descripcion}</Dialog.Description>
              </div>
              <Dialog.Close disabled={pendiente} type="button" aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </header>
            <form id={idFormulario} onSubmit={enviar} className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {error && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <fieldset disabled={pendiente || desactualizado} className="min-w-0 space-y-4">
                {eliminando ? (
                  <p className="break-words text-sm"><strong>{categoria?.nombre}</strong> · {cantidadProductos(vinculados.length)}</p>
                ) : (
                  <>
                    <div hidden={Boolean(confirmacion)} className="space-y-4">
                      {asignando ? (
                        <label className="block text-sm font-medium">
                          Categoría de destino
                          <select name="destino" className={campo} defaultValue="" required>
                            <option value="" disabled>Selecciona una categoría</option>
                            {categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.activa ? "" : " (inactiva)"}</option>)}
                          </select>
                        </label>
                      ) : (
                        <>
                          <label className="block text-sm font-medium">Nombre<input name="nombre" className={campo} required defaultValue={categoria?.nombre} /></label>
                          <label className="block text-sm font-medium">Descripción<textarea name="descripcion" className={campo} rows={2} defaultValue={categoria?.descripcion ?? ""} /></label>
                          <div className="flex flex-wrap items-end gap-4">
                            <label className="block text-sm font-medium">
                              Orden de visualización
                              <input name="orden" type="number" step={1} min={-2147483648} max={2147483647} required className={campo} defaultValue={categoria?.orden ?? 0} />
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                              <input name="activa" type="checkbox" defaultChecked={categoria?.activa ?? true} /> Activa en el catálogo
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground">Los productos sin categoría activa quedan fuera del catálogo público.</p>
                        </>
                      )}
                      <div className="space-y-2 border-t border-border pt-4">
                        <label className="block text-sm font-medium">Buscar productos<input type="search" className={campo} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
                        <p aria-live="polite" className="text-sm text-muted-foreground">{cantidadProductos(seleccion.size)} en la selección</p>
                        {visibles.length ? (
                          <ul className="divide-y divide-border rounded-lg border border-border">
                            {visibles.map((producto) => {
                              const quitar = categoria && producto.categoria_id === categoria.id;
                              return (
                                <li key={producto.id}>
                                  <label className="flex min-h-11 cursor-pointer items-center gap-3 p-3 hover:bg-muted/60">
                                    <input type="checkbox" checked={seleccion.has(producto.id)} onChange={() => cambiarSeleccion(producto.id)} />
                                    <span className="min-w-0 flex-1 break-words text-sm">
                                      <span className="block font-medium">{producto.nombre}</span>
                                      <span className="text-muted-foreground">{nombreCategoria(producto.categoria_id)}</span>
                                    </span>
                                    {!asignando && <span className={quitar ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{quitar ? "Quitar" : "Añadir"}</span>}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        ) : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No hay productos que coincidan.</p>}
                      </div>
                    </div>
                    {confirmacion && (
                      <section ref={resumenTraslado} tabIndex={-1} className="space-y-3 rounded-lg border border-border bg-muted p-4 focus-visible:outline-ring">
                        <h3 className="font-semibold">Confirmar traslado</h3>
                        <p className="break-words text-sm">Estos productos pasarán a {confirmacion.datos.nombre} al guardar.</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {traslados.map((producto) => <li className="break-words" key={producto.id}>{producto.nombre} · {nombreCategoria(producto.categoria_id)}</li>)}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </fieldset>
            </form>
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border p-4 sm:px-6">
              {confirmacion && !desactualizado ? (
                <Button variant="outline" disabled={pendiente} onClick={() => { setConfirmacion(null); setError(""); }}>Volver a editar</Button>
              ) : <Dialog.Close disabled={pendiente} render={<Button variant="outline" />}>Cancelar</Dialog.Close>}
              {desactualizado ? (
                <Button disabled={pendiente} onClick={() => { router.refresh(); cerrar(); }}>Volver a cargar</Button>
              ) : (
                <Button type="submit" form={idFormulario} variant={eliminando ? "destructive" : "default"} disabled={pendiente || (asignando && (!categorias.length || !seleccion.size))}>
                  {pendiente ? "Guardando…" : eliminando ? "Eliminar categoría" : asignando ? "Asignar categoría" : confirmacion ? "Confirmar y guardar" : "Guardar categoría"}
                </Button>
              )}
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
