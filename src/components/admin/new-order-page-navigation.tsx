"use client";

import { useEffect } from "react";

// Excepción estática para enlaces internos futuros que utilicen el App Router.
// Cargar el documento libera los slots y conserva la URL completa (cliente_id).
export default function NewOrderPageNavigation() {
  useEffect(() => {
    // Reemplazar esta entrada evita agregar un salto intermedio al pulsar Atrás.
    window.location.replace(window.location.href);
  }, []);

  return <p role="status">Abriendo formulario de creación de pedido…</p>;
}
