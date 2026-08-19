import "server-only";

import { ROUTES } from "@/config/routes";
import {
  ensureCustomerAccountWithRpc,
  esErrorClienteInactivo,
  type CuentaClienteAsegurada,
} from "@/lib/account/ensure-customer-account";
import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";

type EjecutarEnsureCuentaCliente = () => PromiseLike<{ data: unknown; error: unknown }>;

export type ResultadoPostAuth =
  | { estado: "listo"; destino: string; cuenta: CuentaClienteAsegurada }
  | { estado: "cliente_inactivo" };

export async function resolverDestinoPostAuth(
  ejecutarEnsure: EjecutarEnsureCuentaCliente,
  returnToSinValidar: string | undefined,
): Promise<ResultadoPostAuth> {
  try {
    const cuenta = await ensureCustomerAccountWithRpc(ejecutarEnsure);
    if (cuenta.rol === "admin") return { estado: "listo", destino: ROUTES.admin, cuenta };
    if (!cuenta.clienteActivo) return { estado: "cliente_inactivo" };

    return {
      estado: "listo",
      destino: obtenerReturnToAutenticacionSeguro(returnToSinValidar) ?? ROUTES.home,
      cuenta,
    };
  } catch (error) {
    if (esErrorClienteInactivo(error)) return { estado: "cliente_inactivo" };
    throw error;
  }
}
