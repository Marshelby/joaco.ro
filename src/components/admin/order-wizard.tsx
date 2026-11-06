"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";

const pasos = [
  { id: "cliente", titulo: "Cliente y ubicación", siguiente: "Continuar a productos" },
  { id: "productos", titulo: "Productos y cantidades", siguiente: "Continuar a precios" },
  { id: "precios", titulo: "Precios", siguiente: "Continuar a entrega y pago" },
  { id: "entrega", titulo: "Fecha de entrega y métodos de pago", siguiente: "Ver resumen preliminar" },
  { id: "confirmacion", titulo: "Resumen y confirmación", siguiente: "" },
];
type Estado = { valido: boolean; motivo: string };
const WizardContext = createContext<{
  activo: number;
  registrar: (paso: number, valido: boolean, motivo: string) => void;
  pasosValidos: boolean;
  bloqueado: boolean;
  bloquear: (valor: boolean) => void;
  completar: (destino: string) => void;
} | null>(null);

export function useOrderWizard() {
  const contexto = useContext(WizardContext);
  if (!contexto) throw new Error("El paso debe estar dentro del asistente de pedidos.");
  return contexto;
}

export function useOrderStep(paso: number, valido: boolean, motivo: string) {
  const { registrar } = useOrderWizard();
  useEffect(() => { registrar(paso, valido, motivo); }, [registrar, paso, valido, motivo]);
}

export function OrderWizard({ children }: { children: ReactNode }) {
  const [activo, setActivo] = useState(0);
  const [bloqueado, bloquear] = useState(false);
  const [destino, completar] = useState("");
  const [desbloqueado, setDesbloqueado] = useState(0);
  const [estados, setEstados] = useState<Estado[]>(Array.from({ length: 4 }, () => ({ valido: false, motivo: "Completa los datos obligatorios de este paso." })));
  const cabecera = useRef<HTMLParagraphElement>(null);
  const registrar = useCallback((paso: number, valido: boolean, motivo: string) => {
    setEstados((previos) => previos[paso].valido === valido && previos[paso].motivo === motivo ? previos : previos.map((estado, indice) => indice === paso ? { valido, motivo } : estado));
  }, []);
  const primerInvalido = estados.findIndex((estado) => !estado.valido);
  const limite = Math.min(desbloqueado, primerInvalido === -1 ? 4 : primerInvalido);
  const visible = bloqueado ? 4 : Math.min(activo, limite);
  useEffect(() => {
    setActivo(visible);
    cabecera.current?.focus();
  }, [visible]);
  function ir(paso: number) {
    if (!bloqueado && paso <= limite) setActivo(paso);
  }
  // Desmontar los pasos borra íntegramente su estado solo tras éxito verificado.
  if (destino) return <p role="status">Pedido creado. <a href={destino} className="underline">Ir al detalle del pedido</a></p>;
  return <WizardContext.Provider value={{ activo: visible, registrar, pasosValidos: primerInvalido === -1, bloqueado, bloquear, completar }}>
    <div className="min-w-0 space-y-5 break-words">
      <nav aria-label="Pasos de creación del pedido" className="min-w-0 rounded-xl border border-border bg-card p-2 sm:p-4">
        <ol className="grid grid-cols-5 gap-1 sm:gap-3">
          {pasos.map((paso, indice) => {
            const actual = indice === visible;
            const pasoBloqueado = indice > limite || bloqueado;
            const completado = indice < desbloqueado && (indice === 4 || estados[indice].valido) && !pasoBloqueado;
            return <li key={paso.id} className="min-w-0">
              <button type="button" aria-label={`${indice + 1}. ${paso.titulo}`} aria-current={actual ? "step" : undefined} disabled={pasoBloqueado} title={bloqueado ? "Recupera el resultado de la confirmación antes de editar." : pasoBloqueado ? "Completa los pasos anteriores para desbloquear este paso." : paso.titulo} onClick={() => ir(indice)} className={`flex min-h-20 w-full min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-3 text-center text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm ${actual ? "bg-primary/10 font-semibold text-primary" : completado ? "bg-muted text-foreground" : "text-muted-foreground"} disabled:opacity-50`}>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${actual ? "border-primary bg-primary text-primary-foreground" : completado ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{indice + 1}{completado && !actual ? <span aria-hidden="true" className="ml-0.5 text-[10px]">✓</span> : null}</span>
                <span className="hidden break-words sm:block">{paso.titulo}</span>
                <span className="sr-only">{actual ? "Actual" : pasoBloqueado ? "Bloqueado" : completado ? "Completado" : "Disponible"}</span>
              </button>
            </li>;
          })}
        </ol>
      </nav>
      <p ref={cabecera} tabIndex={-1} className="text-sm font-medium outline-none" aria-live="polite">Paso {visible + 1} de 5 · {pasos[visible].titulo}</p>
      {/* Los pasos permanecen montados para conservar todo el borrador. */}
      {children}
      <div className="rounded-xl border border-border bg-card p-4">
        {visible < 4 && !estados[visible].valido ? <p id="bloqueo-paso" role="status" className="mb-4 text-sm text-muted-foreground">{estados[visible].motivo}</p> : null}
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={visible === 0 || bloqueado} onClick={() => ir(visible - 1)}>← Anterior</button>
          {visible < 4 ? <button type="button" className={`${buttonVariants()} max-w-full whitespace-normal text-center`} disabled={!estados[visible].valido} aria-describedby={!estados[visible].valido ? "bloqueo-paso" : undefined} onClick={() => {
            if (!estados[visible].valido) return;
            setDesbloqueado((previo) => Math.max(previo, visible + 1));
            setActivo(visible + 1);
          }}>{pasos[visible].siguiente} · Siguiente →</button> : null}
        </div>
      </div>
    </div>
  </WizardContext.Provider>;
}
