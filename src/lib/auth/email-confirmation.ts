import { ROUTES } from "@/config/routes";
import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";

const dominioValido = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export function enmascararCorreo(email: string) {
  const [local, dominio, ...resto] = email.trim().toLowerCase().split("@");
  if (!local || !dominio || resto.length > 0 || !dominioValido.test(dominio)) return null;

  const visibles = Math.min(3, local.length);
  const ocultos = Math.max(4, local.length - visibles);
  return `${local.slice(0, visibles)}${"•".repeat(ocultos)}@${dominio}`;
}

export function esCorreoGoogle(email: string) {
  const dominio = email.trim().toLowerCase().split("@")[1];
  return dominio === "gmail.com" || dominio === "googlemail.com";
}

export function obtenerCorreoEnmascaradoSeguro(valor: string | undefined) {
  if (!valor || valor.length > 160) return null;
  const [local, dominio, ...resto] = valor.split("@");
  if (!local || !dominio || resto.length > 0 || !local.includes("•") || !dominioValido.test(dominio)) return null;
  return valor;
}

export function hrefConfirmarCorreo(email: string, returnTo: string | undefined) {
  const correo = enmascararCorreo(email);
  const parametros = new URLSearchParams();
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);

  if (correo) parametros.set("correo", correo);
  if (esCorreoGoogle(email)) parametros.set("gmail", "1");
  if (destino) parametros.set("returnTo", destino);

  const query = parametros.toString();
  return query ? `${ROUTES.confirmEmail}?${query}` : ROUTES.confirmEmail;
}
