"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDown, ArrowUp, FolderOpen, Plus, X } from "lucide-react";
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
  const router = useRouter();
  const [reordenando, iniciarReordenamiento] = useTransition();
  const ordenEnCurso = useRef(false);
  const [errorOrden, setErrorOrden] = useState("");
  const [ordenDesactualizado, setOrdenDesactualizado] = useState(false);
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

  function mover(categoria: CategoriaGestor, direccion: -1 | 1) {
    if (ordenEnCurso.current || ordenDesactualizado) return;
    ordenEnCurso.current = true;
    setErrorOrden("");
    setAviso("");
    iniciarReordenamiento(async () => {
      try {
        const resultado = await gestionarCategoria({
          tipo: "reordenar",
          categorias: categorias.map(version),
          id: categoria.id,
          direccion,
        });
        if (resultado.error) {
          setErrorOrden(resultado.error);
          setOrdenDesactualizado(Boolean(resultado.recargar));
        } else {
          setAviso(`${categoria.nombre}: posición actualizada.`);
        }
      } catch {
        setErrorOrden("No se pudo confirmar el orden. Vuelve a cargar las categorías.");
        setOrdenDesactualizado(true);
      } finally {
        ordenEnCurso.current = false;
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button ref={botonCrear} disabled={reordenando} onClick={(e) => abrir({ tipo: "crear" }, e.currentTarget)}>
          <Plus aria-hidden="true" /> Nueva categoría
        </Button>
        <Button variant="outline" disabled={reordenando} onClick={(e) => abrir({ tipo: "asignar" }, e.currentTarget)}>
          <FolderOpen aria-hidden="true" /> Productos sin categoría ({conteos.get(null) ?? 0})
        </Button>
      </div>
      <p role="status" className={aviso ? "rounded-lg bg-muted p-3 text-sm" : "sr-only"}>{aviso}</p>
      {errorOrden && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errorOrden}</p>}
      {ordenDesactualizado && (
        <Button variant="outline" disabled={reordenando} onClick={() => {
          iniciarReordenamiento(() => {
            router.refresh();
            setOrdenDesactualizado(false);
            setErrorOrden("");
          });
        }}>Volver a cargar categorías</Button>
      )}
      {categorias.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {categorias.map((categoria, posicion) => (
            <li key={categoria.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0 space-y-1">
                <h3 className="break-words font-semibold">{categoria.nombre}</h3>
                {categoria.descripcion && <p className="break-words text-sm text-muted-foreground">{categoria.descripcion}</p>}
                <p className="text-sm text-muted-foreground">
                  {cantidadProductos(conteos.get(categoria.id) ?? 0)} · Orden {categoria.orden} · {categoria.activa ? "Activa" : "Inactiva"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={reordenando || ordenDesactualizado || posicion === 0} aria-label={`Subir ${categoria.nombre}`} onClick={() => mover(categoria, -1)}>
                  <ArrowUp aria-hidden="true" /> Subir
                </Button>
                <Button variant="outline" disabled={reordenando || ordenDesactualizado || posicion === categorias.length - 1} aria-label={`Bajar ${categoria.nombre}`} onClick={() => mover(categoria, 1)}>
                  <ArrowDown aria-hidden="true" /> Bajar
                </Button>
                <Button variant="outline" disabled={reordenando} aria-label={`Editar ${categoria.nombre}`} onClick={(e) => abrir({ tipo: "editar", categoria }, e.currentTarget)}>Editar</Button>
                <Button variant="destructive" disabled={reordenando} aria-label={`Eliminar ${categoria.nombre}`} onClick={(e) => abrir({ tipo: "eliminar", categoria }, e.currentTarget)}>Eliminar</Button>
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
  const datosModificados = useRef(false);
  const buscarProductos = useRef<HTMLInputElement>(null);
  const resumenCambios = useRef<HTMLElement | null>(null);
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
  const coincide = (producto: ProductoClasificable) =>
    normalizeCatalogText(`${producto.nombre} ${nombreCategoria(producto.categoria_id)}`).includes(textoBusqueda);
  const disponibles = productos.filter((producto) =>
    asignando ? producto.categoria_id === null : !categoria || producto.categoria_id !== categoria.id);
  const cambiosConfirmados = new Map(confirmacion?.productos.map((cambio) => [cambio.id, cambio]));
  const productosConfirmados = productos.filter((producto) => {
    const cambio = cambiosConfirmados.get(producto.id);
    return cambio && (cambio.quitar || cambio.origen !== null);
  });

  useEffect(() => {
    if (confirmacion) resumenCambios.current?.focus();
  }, [confirmacion]);

  function cambiarSeleccion(id: string) {
    setSeleccion((anterior) => {
      const siguiente = new Set(anterior);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function ejecutar(operacion: Exclude<OperacionCategoria, { tipo: "reordenar" }>) {
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
    if (operacion.productos.some((cambio) => cambio.quitar || cambio.origen !== null)) {
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
      : "Los cambios de productos se aplican al guardar.";

  function puedeCerrar() {
    return !enviando.current && (
      (!datosModificados.current && seleccion.size === 0) || window.confirm("¿Descartar los cambios sin guardar?")
    );
  }

  return (
    <Dialog.Root open disablePointerDismissal onOpenChange={(abierto, detalles) => {
      if (abierto) return;
      if (puedeCerrar()) cerrar();
      else detalles.cancel();
    }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden p-2 sm:items-center sm:p-4">
          <Dialog.Popup
            aria-busy={pendiente}
            finalFocus={devolverFoco}
            className="motion-dialog-content flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl outline-none sm:max-h-[85dvh]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">{descripcion}</Dialog.Description>
              </div>
              <Dialog.Close disabled={pendiente} type="button" aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </header>
            <form id={idFormulario} onSubmit={enviar} onChange={(evento) => {
              if (evento.target instanceof HTMLElement && evento.target.hasAttribute("name")) {
                datosModificados.current = true;
              }
            }} className="min-h-0 overflow-y-auto overscroll-contain p-4">
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
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium">Nombre<input name="nombre" className={campo} required defaultValue={categoria?.nombre} /></label>
                          <label className="block text-sm font-medium">Descripción<textarea name="descripcion" className={campo} rows={2} defaultValue={categoria?.descripcion ?? ""} /></label>
                          <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
                            <label className="block text-sm font-medium">
                              Orden de visualización
                              <input name="orden" type="number" step={1} min={-2147483648} max={2147483647} required className={campo} defaultValue={categoria?.orden ?? 0} />
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                              <input name="activa" type="checkbox" defaultChecked={categoria?.activa ?? true} /> Activa en el catálogo
                            </label>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 border-t border-border pt-4">
                        <label className="block text-sm font-medium">Buscar productos<input ref={buscarProductos} type="search" className={campo} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label>
                        <p aria-live="polite" className="text-sm text-muted-foreground">{cantidadProductos(seleccion.size)} {asignando ? "en la selección" : "con cambios pendientes"}</p>
                        <div className={asignando ? undefined : "grid items-start gap-3 sm:grid-cols-2"}>
                          {!asignando && (
                            <ListaProductosCategoria titulo="Mis productos" productos={vinculados.filter(coincide)} total={vinculados.length}
                              seleccion={seleccion} cambiar={cambiarSeleccion} nombreCategoria={nombreCategoria} quitar />
                          )}
                          <ListaProductosCategoria titulo={asignando ? "Sin categoría" : "Disponibles para añadir"}
                            productos={disponibles.filter(coincide)} total={disponibles.length}
                            seleccion={seleccion} cambiar={cambiarSeleccion} nombreCategoria={nombreCategoria} asignando={asignando} />
                        </div>
                      </div>
                    </div>
                    {confirmacion && (
                      <section ref={resumenCambios} tabIndex={-1} className="space-y-3 rounded-lg border border-border bg-muted p-4 focus-visible:outline-ring">
                        <h3 className="font-semibold">Confirmar cambios de categoría</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {productosConfirmados.map((producto) => (
                            <li className="break-words" key={producto.id}>
                              {producto.nombre} · {cambiosConfirmados.get(producto.id)?.quitar
                                ? "Quedará sin categoría y se ocultará del catálogo público"
                                : `Pasará de ${nombreCategoria(producto.categoria_id)} a ${confirmacion.datos.nombre}`}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </fieldset>
            </form>
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
              {confirmacion && !desactualizado ? (
                <Button variant="outline" disabled={pendiente} onClick={() => {
                  setConfirmacion(null);
                  setError("");
                  requestAnimationFrame(() => buscarProductos.current?.focus());
                }}>Volver a editar</Button>
              ) : <Dialog.Close disabled={pendiente} render={<Button variant="outline" />}>Cancelar</Dialog.Close>}
              {desactualizado ? (
                <Button disabled={pendiente} onClick={() => {
                  if (!puedeCerrar()) return;
                  router.refresh();
                  cerrar();
                }}>Volver a cargar</Button>
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

function ListaProductosCategoria({ titulo, productos, total, seleccion, cambiar, nombreCategoria, quitar = false, asignando = false }: {
  titulo: string;
  productos: ProductoClasificable[];
  total: number;
  seleccion: Set<string>;
  cambiar: (id: string) => void;
  nombreCategoria: (id: string | null) => string;
  quitar?: boolean;
  asignando?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <h3 className="bg-muted px-3 py-2 text-sm font-semibold">
        {titulo} <span className="font-normal text-muted-foreground">({productos.length === total ? total : `${productos.length} de ${total}`})</span>
      </h3>
      {productos.length ? (
        <ul className="divide-y divide-border">
          {productos.map((producto) => {
            const marcado = seleccion.has(producto.id);
            const accion = quitar ? "Quitar" : producto.categoria_id ? "Trasladar" : "Añadir";
            return (
              <li key={producto.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/60">
                  <input type="checkbox" checked={marcado} onChange={() => cambiar(producto.id)} />
                  <span className="min-w-0 flex-1 break-words text-sm">
                    <span className="block font-medium">{producto.nombre}</span>
                    <span className="text-xs text-muted-foreground">{nombreCategoria(producto.categoria_id)}</span>
                  </span>
                  {!asignando && <span className={quitar ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{marcado ? `${accion} al guardar` : accion}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      ) : <p className="px-3 py-2 text-sm text-muted-foreground">{total ? "Sin coincidencias." : "Sin productos."}</p>}
    </section>
  );
}
