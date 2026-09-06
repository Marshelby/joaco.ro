"use client";

import { Send } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type MessageComposerProps = {
  onSend: (contenido: string, claveIdempotencia: string) => Promise<boolean>;
  label?: string;
  placeholder?: string;
};

export function MessageComposer({ onSend, label = "Escribe un mensaje para Hidro Leufú", placeholder = "Escribe tu mensaje" }: MessageComposerProps) {
  const [contenido, setContenido] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const claveIdempotencia = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const puedeEnviar = contenido.trim().length > 0 && !pendiente;

  async function enviar() {
    if (!puedeEnviar) return;
    setPendiente(true);
    claveIdempotencia.current ??= crypto.randomUUID();
    const enviado = await onSend(contenido, claveIdempotencia.current);
    setPendiente(false);
    if (enviado) {
      claveIdempotencia.current = null;
      setContenido("");
      textareaRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void enviar();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void enviar();
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-card p-3 sm:p-4">
      <label htmlFor="mensaje-contenido" className="sr-only">{label}</label>
      <div className="flex items-end gap-2">
          <textarea ref={textareaRef} id="mensaje-contenido" value={contenido} onChange={(event) => setContenido(event.target.value)} onKeyDown={onKeyDown} maxLength={2000} rows={2} disabled={pendiente} placeholder={placeholder} className="min-h-11 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60" />
        <Button type="submit" aria-label="Enviar mensaje" disabled={!puedeEnviar} className="h-11 px-3 sm:px-4"><Send className="size-4" aria-hidden="true" /><span className="hidden sm:inline">{pendiente ? "Enviando…" : "Enviar"}</span></Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><p>Enter para enviar · Shift + Enter para una nueva línea.</p><span aria-hidden="true">{contenido.length}/2000</span></div>
    </form>
  );
}
