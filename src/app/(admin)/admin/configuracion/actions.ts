"use server";

import { revalidatePath } from "next/cache";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type EstadoDiaEntrega = { error?: string; exito?: string; diagnostico?: string };

// Los detalles de Postgres pueden contener filas completas. Nunca devolverlos al navegador.
function errorHoraCorte(error: { code?: string; message: string; hint?: string }, etapa: string): EstadoDiaEntrega {
  const referencia = crypto.randomUUID();
  const codigo = /^[A-Z0-9_]{1,32}$/.test(error.code ?? "") ? error.code! : "SIN_CODIGO";
  const limpiar = (valor: string) => valor
    .replace(/https?:\/\/\S+/gi, "[URL omitida]")
    .replace(/\beyJ[A-Za-z0-9_.-]+/g, "[token omitido]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[clave omitida]")
    .slice(0, 1500);
  console.error("[configuracion:hora-corte]", {
    referencia, etapa, codigo,
    rpc: "public.guardar_hora_corte_administrativa(p_hora_corte time without time zone)",
    mensaje: limpiar(error.message),
    hint: error.hint ? limpiar(error.hint) : undefined,
  });
  let mensaje = mensajesRpc[error.message] ?? "No fue posible guardar la hora límite.";
  if (error.message.includes("UPDATE requires a WHERE clause")) {
    mensaje = "La base de datos rechazó el UPDATE sin WHERE. Ejecuta manualmente supabase/manual/corregir_guardado_hora_limite_entrega.sql.";
  } else if (codigo === "PGRST202" || codigo === "42883") {
    mensaje = "La API no encuentra la RPC o una función que esta utiliza. Revisa el diagnóstico del servidor; esto no demuestra que el SQL haya fallado.";
  } else if (codigo === "42501" && !mensajesRpc[error.message]) {
    mensaje = "La base de datos denegó permisos al guardar la hora límite. Revisa el diagnóstico del servidor.";
  } else if (codigo === "23514") {
    mensaje = "Una restricción de la base de datos rechazó la hora. Revisa el diagnóstico del servidor.";
  }
  return { error: mensaje, diagnostico: `Etapa: ${etapa}. Código: ${codigo}. Referencia: ${referencia}. El error técnico está en el registro del servidor [configuracion:hora-corte].` };
}

const mensajesRpc: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos para cambiar la configuración de entregas.",
  DIA_SEMANA_INVALIDO: "Selecciona un día de la semana válido.",
  ACTIVO_INVALIDO: "No fue posible leer el estado del día.",
  HORA_CORTE_INVALIDA: "Selecciona una hora válida entre 00:00 y 23:59.",
  DIAS_ENTREGA_VACIOS: "No existen días de entrega configurados. No se guardó la hora límite.",
};

function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

export async function guardarDiaEntregaAdministrativo(
  _: EstadoDiaEntrega,
  datos: FormData,
): Promise<EstadoDiaEntrega> {
  const diaSemana = Number(texto(datos, "diaSemana"));

  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
    return { error: mensajesRpc.DIA_SEMANA_INVALIDO };
  }

  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { error } = await supabase.rpc("guardar_dia_entrega_administrativo", {
    p_dia_semana: diaSemana,
    p_activo: datos.get("activo") === "on",
    p_hora_corte: null,
    p_dias_anticipacion_corte: 0,
  });
  if (error) return { error: mensajesRpc[error.message] ?? "No fue posible guardar este día de entrega." };

  revalidatePath("/admin/configuracion");
  return { exito: "Día de entrega actualizado." };
}

export async function guardarHoraCorteAdministrativa(
  _: EstadoDiaEntrega,
  datos: FormData,
): Promise<EstadoDiaEntrega> {
  const hora = texto(datos, "horaCorte");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return { error: mensajesRpc.HORA_CORTE_INVALIDA };
  }
  const supabase = await crearClienteSupabaseServidor();
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion) return errorHoraCorte(errorSesion, "sesion");
  if (!sesion.user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };
  // Las Actions son invocables directamente: el layout no es una barrera de autorización.
  const { data: esAdmin, error: errorPermiso } = await supabase.rpc("es_admin");
  if (errorPermiso) return errorHoraCorte(errorPermiso, "autorizacion");
  if (esAdmin !== true) return { error: mensajesRpc.NO_AUTORIZADO };
  const { error } = await supabase.rpc("guardar_hora_corte_administrativa", { p_hora_corte: `${hora}:00` });
  if (error) return errorHoraCorte(error, "guardar");
  // Una RPC void también puede responder éxito sin actualizar ninguna fila.
  const { data: dias, error: errorLectura } = await supabase.from("dias_entrega").select("hora_corte");
  if (errorLectura) return errorHoraCorte(errorLectura, "verificar persistencia (RPC completada)");
  if (!dias?.length || dias.some((dia) => dia.hora_corte !== `${hora}:00`)) {
    return errorHoraCorte({ code: "PERSISTENCIA", message: "La lectura posterior no confirma la hora en todos los días de entrega." }, "verificar persistencia (RPC completada)");
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/checkout");
  return { exito: "Hora límite actualizada para todos los días de entrega." };
}
