import "server-only";
import { administradorProduccion } from "./servidor";
import { fechaValida, hoySantiago, type Lugar, type Unidad } from "./contrato";
export type Diario = { unidad_id: string; fecha_operativa: string; tipo_actividad: string; cultivo: string | null; medida: string | null; cantidad: number | null; registros: number; cantidades_conocidas: number; importe: number | null; sin_importe: number };
export type Resumen = { lugares: Lugar[]; unidades: Unidad[]; configuraciones: { unidad_id: string; vigente_desde: string; cultivo: string; capacidad: number | null; cantidad_gallinas: number | null }[]; diario: Diario[] };
export function desplazar(fecha: string, dias: number) {
 const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+dias); return d.toISOString().slice(0,10);
}
export function rangoResumen(p: Record<string,string | string[] | undefined>) {
 if(Object.values(p).some(v=>Array.isArray(v))) throw new Error("Revisa los filtros repetidos.");
 const valor = (k:string) => typeof p[k] === "string" ? p[k] as string : "";
 const periodo = valor("periodo") || "mes", fecha = valor("fecha") || hoySantiago();
 if(!fechaValida(fecha) || !["dia","semana","mes","rango"].includes(periodo)) throw new Error("Revisa el período y la fecha.");
 let desde=fecha, hasta=fecha;
 if(periodo==="semana") { const dia=new Date(`${fecha}T12:00:00Z`).getUTCDay(); desde=desplazar(fecha,-((dia+6)%7)); hasta=desplazar(desde,6); }
 if(periodo==="mes") { desde=fecha.slice(0,7)+"-01"; const d=new Date(`${desde}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(0); hasta=d.toISOString().slice(0,10); }
 if(periodo==="rango") { desde=valor("desde"); hasta=valor("hasta"); }
 if(!fechaValida(desde)||!fechaValida(hasta)||desde>hasta) throw new Error("Indica un rango de fechas válido.");
 const dias=Math.round((Date.parse(hasta)-Date.parse(desde))/86400000)+1;
 if(dias>366 || desde<"0002-01-01" || hasta>"9998-12-31") throw new Error("Selecciona hasta 366 días entre los años 0002 y 9998.");
 const lugar=valor("lugar"),unidad=valor("unidad"),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if((lugar&&!uuid.test(lugar))||(unidad&&!uuid.test(unidad))) throw new Error("Selecciona un lugar y una unidad válidos.");
 return {periodo,fecha,desde,hasta,dias,anterior:desplazar(desde,-dias),lugar,unidad};
}
export async function consultarResumen(r: ReturnType<typeof rangoResumen>): Promise<{data?:Resumen; error?:string}> {
 const cliente=await administradorProduccion();
 const {data,error}=await cliente.rpc("resumen_produccion",{p_desde:r.desde,p_hasta:r.hasta,p_lugar:r.lugar||null,p_unidad:r.unidad||null});
 if(error) return {error:["PGRST202","42883","42P01","42703"].includes(error.code) ? "Resumen pendiente de habilitación: aplicar manualmente supabase/manual/produccion_fase9_complemento.sql después de los complementos de Fases 3, 5 y 7." : "No fue posible consultar el resumen. Revisa que la unidad pertenezca al lugar elegido e intenta nuevamente."};
 return {data:data as Resumen};
}
