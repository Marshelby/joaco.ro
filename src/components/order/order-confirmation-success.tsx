"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const CLAVE_SONIDO = "hidro-leufu-order-confirmation-sound";

function reproducirSonidoConfirmacion() {
  try {
    const contexto = new AudioContext();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    const inicio = contexto.currentTime;

    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(660, inicio);
    oscilador.frequency.exponentialRampToValueAtTime(880, inicio + 0.12);
    ganancia.gain.setValueAtTime(0.0001, inicio);
    ganancia.gain.exponentialRampToValueAtTime(0.08, inicio + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);
    oscilador.connect(ganancia).connect(contexto.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.21);
    oscilador.addEventListener("ended", () => void contexto.close());
  } catch {
    // Algunos navegadores bloquean el audio sin gesto directo; la confirmación no depende de él.
  }
}

export function OrderConfirmationSuccess({ pedidoId, reproducirSonido }: { pedidoId: string; reproducirSonido: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!reproducirSonido) return;
    const clavePedido = `${CLAVE_SONIDO}:${pedidoId}`;
    if (window.sessionStorage.getItem(clavePedido)) return;
    window.sessionStorage.setItem(clavePedido, "1");
    reproducirSonidoConfirmacion();
  }, [pedidoId, reproducirSonido]);

  return (
    <div className={`inline-flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary transition duration-300 motion-reduce:transition-none ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`} aria-hidden="true">
      <Check className="size-7" strokeWidth={2.5} />
    </div>
  );
}
