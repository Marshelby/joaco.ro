import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";
import { enmascararCorreo, esCorreoGoogle } from "@/lib/auth/email-confirmation";

export const RECOVERY_EMAIL_PREFILL_STORAGE_KEY = "hidro-leufu-recovery-email";

export function hrefRecuperacionEnviada(email: string, returnTo: string | undefined) {
  const parametros = new URLSearchParams();
  const correo = enmascararCorreo(email);
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);

  if (correo) parametros.set("correo", correo);
  if (esCorreoGoogle(email)) parametros.set("gmail", "1");
  if (destino) parametros.set("returnTo", destino);

  const query = parametros.toString();
  return query ? `/recuperar-contrasena/enviado?${query}` : "/recuperar-contrasena/enviado";
}

export function hrefActualizarContrasena(returnTo: string | undefined, enlaceInvalido = false) {
  const parametros = new URLSearchParams();
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);
  if (destino) parametros.set("returnTo", destino);
  if (enlaceInvalido) parametros.set("estado", "invalido");
  const query = parametros.toString();
  return query ? `/actualizar-contrasena?${query}` : "/actualizar-contrasena";
}
