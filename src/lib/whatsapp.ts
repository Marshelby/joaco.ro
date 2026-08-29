const PATRON_TELEFONO_CHILENO_INTERNACIONAL = /^569\d{8}$/;
const PATRON_TELEFONO_CHILENO_LOCAL = /^9\d{8}$/;
const PATRON_FORMATO_TELEFONO = /^\+?[\d\s()-]+$/;

export type ContextoMensajeEntrega = {
  numeroPedido: string;
  estado: string;
  nombreEmisor?: string | null;
};

/** Normaliza únicamente números móviles chilenos inequívocos para wa.me. */
export function normalizarTelefonoWhatsapp(telefono: string | null | undefined): string | null {
  const valor = telefono?.trim();
  if (!valor || !PATRON_FORMATO_TELEFONO.test(valor)) return null;

  const digitos = valor.replace(/[^\d]/g, "");
  if (PATRON_TELEFONO_CHILENO_INTERNACIONAL.test(digitos)) return digitos;
  if (PATRON_TELEFONO_CHILENO_LOCAL.test(digitos)) return `56${digitos}`;

  return null;
}

export function crearEnlaceWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const telefonoNormalizado = normalizarTelefonoWhatsapp(telefono);
  if (!telefonoNormalizado) return null;

  return `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensaje)}`;
}

export function crearMensajeEntrega({ numeroPedido, estado, nombreEmisor }: ContextoMensajeEntrega): string {
  const numero = numeroPedido.trim();
  const emisor = nombreEmisor?.trim();

  if (estado === "en_reparto") {
    const saludo = `Hola, buen día. Tu pedido de Hidro Leufú (${numero}) está en camino.`;
    return emisor ? `${saludo} Habla con ${emisor}.` : saludo;
  }

  return `Hola, buen día. Te escribimos desde Hidro Leufú por tu pedido ${numero}.`;
}
