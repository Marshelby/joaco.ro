"use client";

import { useActionState, useState } from "react";

import { actualizarNombreAdministrador, type EstadoCuenta } from "@/app/(customer)/mi-cuenta/actions";
import { campoDireccion } from "@/components/account/address-form-styles";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";

export function AdminNameForm({ nombre }: { nombre: string | null }) {
  const [editando, setEditando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");

  return (
    <div className="mt-5 space-y-3 border-t border-border pt-5">
      <h2 className="text-sm font-medium text-foreground">Nombre de administrador/a</h2>
      {editando ? (
        <EditorNombre
          nombre={nombre ?? ""}
          cancelar={() => setEditando(false)}
          confirmar={(mensaje) => {
            setConfirmacion(mensaje);
            setEditando(false);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-words text-sm text-muted-foreground">{nombre ?? "Sin nombre registrado"}</p>
          <Button type="button" variant="outline" onClick={() => {
            setConfirmacion("");
            setEditando(true);
          }}>
            Editar
          </Button>
        </div>
      )}
      <p role="status" className={confirmacion ? "text-sm text-primary" : "sr-only"}>{confirmacion}</p>
    </div>
  );
}

function EditorNombre({ nombre, cancelar, confirmar }: {
  nombre: string;
  cancelar: () => void;
  confirmar: (mensaje: string) => void;
}) {
  const [borrador, setBorrador] = useState(nombre);
  const [estado, accion, pendiente] = useActionState(async (anterior: EstadoCuenta, datos: FormData) => {
    const resultado = await actualizarNombreAdministrador(anterior, datos);
    if (resultado.exito) confirmar(resultado.exito);
    return resultado;
  }, {});

  return (
    <form action={accion} className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        Nombre
        <input
          type="text"
          name="nombre"
          autoComplete="name"
          required
          readOnly={pendiente}
          value={borrador}
          onChange={(evento) => setBorrador(evento.target.value)}
          className={campoDireccion}
          aria-invalid={estado.error ? true : undefined}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…">Guardar</PendingButton>
        <Button type="button" variant="outline" disabled={pendiente} onClick={cancelar}>Cancelar</Button>
      </div>
      {estado.error ? <p role="alert" className="text-sm text-destructive">{estado.error}</p> : null}
    </form>
  );
}
