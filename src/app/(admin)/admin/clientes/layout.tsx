import type { ReactNode } from "react";

// El slot vive fuera de [id]: el destino de pedidos no contiene el ID del cliente.
export default function CustomersLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <>{children}{modal}</>;
}
