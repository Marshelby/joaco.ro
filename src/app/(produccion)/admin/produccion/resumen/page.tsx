import Link from "next/link";
import { CabeceraProduccion, EstadoProduccion } from "@/components/produccion/identidad";
import { etiquetasActividad } from "@/lib/produccion/actividades";
import { fechaVisible, nombresUnidad } from "@/lib/produccion/contrato";
import { consultarResumen, desplazar, rangoResumen, type Diario } from "@/lib/produccion/resumen";
import { consultarProduccion } from "@/lib/produccion/servidor";
const base="/admin/produccion/resumen";
const numero=(n:number)=>new Intl.NumberFormat("es-CL",{maximumFractionDigits:12}).format(n);
const campo="mt-1 min-h-11 w-full border px-3 py-2 text-base";
type Serie={clave:string; titulo:string; medida:string; filas:Diario[]; dinero?:boolean};
function agrupar(filas:Diario[]):Serie[] {
 const mapa=new Map<string,Serie>();
 for(const f of filas) {
  if(f.cantidad===null && f.tipo_actividad!=="compra_alimento") continue;
  const titulo=[etiquetasActividad[f.tipo_actividad as keyof typeof etiquetasActividad]??f.tipo_actividad,f.cultivo??""].filter(Boolean).join(" · ");
  const clave=JSON.stringify([f.tipo_actividad,f.cultivo,f.medida]);
  if(!mapa.has(clave)) mapa.set(clave,{clave,titulo,medida:f.medida??"sin medida",filas:[]});
  mapa.get(clave)!.filas.push(f);
  if(f.tipo_actividad==="compra_alimento") {
   const k="importe";
   if(!mapa.has(k)) mapa.set(k,{clave:k,titulo:"Compras de alimento",medida:"CLP",dinero:true,filas:[]});
   mapa.get(k)!.filas.push(f);
  }
 }
 return [...mapa.values()];
}
function total(s:Serie,desde:string,hasta:string) {
 const filas=s.filas.filter(f=>f.fecha_operativa>=desde&&f.fecha_operativa<=hasta);
 const conocidos=filas.filter(f=>(s.dinero?f.importe:f.cantidad)!==null);
 const incompleto=filas.some(f=>s.dinero?Number(f.sin_importe)>0:Number(f.cantidades_conocidas)<Number(f.registros));
 return {valor:conocidos.length?conocidos.reduce((n,f)=>n+Number(s.dinero?f.importe:f.cantidad),0):null,incompleto};
}
function valorVisible(valor:number|null,medida:string,incompleto=false) {return valor===null?(incompleto?"Sin importe registrado":"Sin registros"):`${numero(valor)} ${medida==="unidad"?"un.":medida}`;}
export default async function ResumenPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const params=await searchParams;
 let r:ReturnType<typeof rangoResumen>;
 try { r=rangoResumen(params); } catch(error) {return <><CabeceraProduccion etiqueta="Producción a la vista" titulo="Resumen y estadísticas" descripcion="Indicadores agrícolas y avícolas con datos reales."/><p role="alert" className="prod-note">{error instanceof Error?error.message:"Filtros inválidos."}</p><Link className="prod-button" href={base}>Restablecer filtros</Link></>;}
 const {data,error}=await consultarResumen(r);
 // Mantener los selectores disponibles si la RPC rechaza la combinación elegida.
 const opciones=data??await consultarProduccion();
 const lugar=data?.lugares.find(l=>l.id===r.lugar),unidad=data?.unidades.find(u=>u.id===r.unidad);
 const unidades=data?.unidades.filter(u=>(!r.lugar||u.lugar_id===r.lugar)&&(!r.unidad||u.id===r.unidad))??[];
 const filas=data?.diario??[];
 const actuales=filas.filter(f=>f.fecha_operativa>=r.desde);
 const series=agrupar(filas);
 function enlace(l:string,u="") {const p=new URLSearchParams({periodo:r.periodo,fecha:r.fecha,desde:r.desde,hasta:r.hasta});if(l)p.set("lugar",l);if(u)p.set("unidad",u);return `${base}?${p}`;}
 function tarjeta(s:Serie) {
  const actual=total(s,r.desde,r.hasta),previo=total(s,r.anterior,desplazar(r.desde,-1));
  const comparar=actual.valor!==null&&previo.valor!==null&&!actual.incompleto&&!previo.incompleto;
  return <article key={s.clave} className="prod-summary-kpi"><p className="text-sm text-muted-foreground">{s.titulo}</p><p className="mt-3 text-2xl font-semibold">{valorVisible(actual.valor,s.medida,actual.incompleto)}</p>{actual.incompleto&&<p className="mt-2 text-xs">{actual.valor===null?"Importes no registrados":"Total parcial: hay registros incompletos"}</p>}<p className="mt-3 text-xs text-muted-foreground">{comparar?`Anterior: ${valorVisible(previo.valor,s.medida)} · Variación: ${numero(actual.valor!-previo.valor!)} ${s.medida}${previo.valor!>0?` (${numero((actual.valor!-previo.valor!)/previo.valor!*100)} %)`:" · Sin base para porcentaje"}`:"Sin datos suficientes para comparar"}</p></article>;
 }
 const destacadas=[
  {tipo:"cosecha",cultivo:"lechuga",medida:"unidad",titulo:"Lechugas cosechadas"},
  {tipo:"cosecha",cultivo:"berro",medida:"kg",titulo:"Berro cosechado"},
  {tipo:"perdidas",cultivo:"lechuga",medida:"unidad",titulo:"Pérdidas de lechuga"},
  {tipo:"perdidas",cultivo:"berro",medida:"kg",titulo:"Pérdidas de berro"},
  {tipo:"colecta_huevos",cultivo:null,medida:"unidad",titulo:"Huevos recolectados"},
  {tipo:"alimentacion",cultivo:null,medida:"kg",titulo:"Alimento consumido"},
 ].map(k=>({clave:`kpi-${k.tipo}-${k.cultivo}`,titulo:k.titulo,medida:k.medida,filas:filas.filter(f=>f.tipo_actividad===k.tipo&&f.cultivo===k.cultivo&&f.medida===k.medida)}));
 const compras:Serie=series.find(s=>s.dinero)??{clave:"importe",titulo:"Compras de alimento",medida:"CLP",dinero:true,filas:[]};
 return <>
  <CabeceraProduccion etiqueta="Producción a la vista" titulo="Resumen y estadísticas" descripcion="Cosechas, cultivos y gallinas en un solo lugar. Fechas operativas de America/Santiago."/>
  <form method="get" className="prod-date-bar">
   <label className="text-sm">Período<select name="periodo" defaultValue={r.periodo} className={campo}><option value="dia">Día</option><option value="semana">Semana (lunes a domingo)</option><option value="mes">Mes</option><option value="rango">Rango personalizado</option></select></label>
   <label className="text-sm">Fecha de referencia<input type="date" name="fecha" defaultValue={r.fecha} required className={campo}/></label>
   <label className="text-sm">Desde (rango)<input type="date" name="desde" defaultValue={r.desde} className={campo}/></label>
   <label className="text-sm">Hasta (rango)<input type="date" name="hasta" defaultValue={r.hasta} className={campo}/></label>
   <label className="text-sm">Nave o gallinero<select name="lugar" defaultValue={r.lugar} className={campo}><option value="">Todos los lugares</option>{opciones.lugares.map(l=><option key={l.id} value={l.id}>{l.nombre}{!l.activo?" (inactivo)":""}</option>)}</select></label><label className="text-sm">Unidad<select name="unidad" defaultValue={r.unidad} className={campo}><option value="">Todas las unidades</option>{opciones.unidades.map(u=><option key={u.id} value={u.id}>{opciones.lugares.find(l=>l.id===u.lugar_id)?.nombre} · {u.nombre}</option>)}</select></label>
   <button className="prod-button prod-button-primary">Aplicar filtros</button><Link className="prod-button" href={base}>Restablecer</Link>
   <p>Máximo 366 días. Fecha de referencia para día, semana y mes.</p>
  </form>
  {error?<p role="alert" className="prod-note">{error}</p>:data&&<>
   <nav aria-label="Detalle del resumen" className="flex flex-wrap items-center gap-3 text-sm"><Link className="prod-button" href={enlace("")}>General</Link>{lugar&&<Link className="prod-button" href={enlace(lugar.id)}>{lugar.nombre}</Link>}{unidad&&<span>{unidad.nombre}</span>}</nav>
   <div><h2 className="prod-section-heading">{unidad?.nombre??lugar?.nombre??"Producción general"}</h2><p className="prod-section-copy">{fechaVisible(r.desde)} al {fechaVisible(r.hasta)} · Comparación con {fechaVisible(r.anterior)} al {fechaVisible(desplazar(r.desde,-1))} ({r.dias} días).</p></div>
   {!actuales.length&&<p className="prod-note">No hay actividades vigentes registradas en este período y selección. La ausencia de registros no representa producción cero.</p>}
   <div className="prod-summary-grid">{destacadas.map(tarjeta)}{tarjeta(compras)}{series.filter(s=>s.filas.some(f=>f.tipo_actividad==="perdidas"&&f.cultivo!=="lechuga"&&f.cultivo!=="berro")).map(tarjeta)}</div>
   <section className="space-y-4"><h2 className="prod-section-heading">Evolución por fecha operativa</h2><p className="prod-section-copy">Cada serie conserva su cultivo y medida. Se muestran solo fechas con registros; no se completan días sin datos con ceros.</p>
    <div className="prod-summary-grid">{series.filter(s=>s.filas.some(f=>f.fecha_operativa>=r.desde)).map(s=>{
     const fechas=[...new Set(s.filas.filter(f=>f.fecha_operativa>=r.desde).map(f=>f.fecha_operativa))].sort();
     const puntos=fechas.map(fecha=>({fecha,...total(s,fecha,fecha)}));
     const max=Math.max(0,...puntos.map(p=>p.valor??0));
     return <article key={s.clave} className="prod-summary-kpi"><h3 className="font-semibold">{s.titulo} · {s.medida}</h3><div className="prod-chart-scroll"><table className="prod-chart-table"><caption className="sr-only">Evolución diaria: {s.titulo}, {s.medida}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Evolución</th><th scope="col">Cantidad</th></tr></thead><tbody>{puntos.map(p=><tr key={p.fecha}><th scope="row">{fechaVisible(p.fecha)}</th><td><span className="prod-chart-track" aria-hidden="true">{p.valor!==null&&<span style={{width:`${max>0?p.valor/max*100:0}%`}}/>}</span></td><td>{valorVisible(p.valor,s.medida,p.incompleto)}{p.incompleto?" (incompleto)":""}</td></tr>)}</tbody></table></div></article>;
    })}</div>{!series.some(s=>s.filas.some(f=>f.fecha_operativa>=r.desde))&&<p className="prod-note">Sin cantidades registradas para graficar.</p>}
   </section>
   <section className="space-y-4"><h2 className="prod-section-heading">{r.lugar||r.unidad?"Resultados por unidad":"Naves y gallineros"}</h2>
    {!r.lugar&&!r.unidad?<div className="prod-summary-grid">{data.lugares.map(l=>{const ids=new Set(data.unidades.filter(u=>u.lugar_id===l.id).map(u=>u.id));const registros=actuales.filter(f=>ids.has(f.unidad_id));return <article key={l.id} className="prod-summary-kpi"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{l.nombre}</h3><EstadoProduccion activo={l.activo}/></div><p className="prod-section-copy">{l.tipo} · {registros.reduce((n,f)=>n+Number(f.registros),0)} actividades vigentes</p>{agrupar(registros).map(s=><p key={s.clave} className="mt-2 text-sm">{s.titulo}: {valorVisible(total(s,r.desde,r.hasta).valor,s.medida,total(s,r.desde,r.hasta).incompleto)}{total(s,r.desde,r.hasta).incompleto?" (incompleto)":""}</p>)}{!registros.length&&<p className="prod-section-copy">Sin registros en el período.</p>}<Link className="prod-button mt-4" href={enlace(l.id)}>Ver resultados →</Link></article>;})}</div>:<div className="space-y-4">{unidades.map(u=>{
     const config=data.configuraciones.find(c=>c.unidad_id===u.id),registros=actuales.filter(f=>f.unidad_id===u.id);
     return <article key={u.id} className="prod-summary-kpi"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{u.nombre} · {nombresUnidad[u.tipo]}</h3><EstadoProduccion activo={u.activo}/></div>
      <p className="prod-section-copy">{config?`${config.cantidad_gallinas!==null?`Gallinas configuradas: ${numero(config.cantidad_gallinas)}`:`Capacidad configurada: ${numero(config.capacidad!)} ${config.cultivo==="berro"?"kg":"un."} · ${config.cultivo}`} · Vigente desde ${fechaVisible(config.vigente_desde)} al cierre del período.`:"Sin configuración vigente al cierre del período."}</p>
      {!registros.length&&<p className="prod-section-copy">Sin registros en el período.{u.tipo==="suelo"?" El esquema actual no habilita actividades para cultivos de tierra.":""}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{agrupar(registros).map(s=>{const t=total(s,r.desde,r.hasta);return <p key={s.clave} className="prod-note">{s.titulo}: {valorVisible(t.valor,s.medida,t.incompleto)}{t.incompleto?" (incompleto)":""}</p>;})}</div>
      <div className="mt-4 flex flex-wrap gap-3">{!r.unidad&&<Link className="prod-button" href={enlace(u.lugar_id,u.id)}>Ver evolución individual →</Link>}<Link className="prod-button" href={`/admin/produccion/historial?${new URLSearchParams({desde:r.desde,hasta:r.hasta,lugar:u.lugar_id,unidad:u.id,estado:"vigentes"})}`}>Ver actividades</Link></div>
     </article>;
    })}</div>}
    {(!data.lugares.length||((r.lugar||r.unidad)&&!unidades.length))&&<p className="prod-note">No hay lugares o unidades para esta selección.</p>}
   </section>
   <p className="prod-note">Solo se calcula con la última versión vigente de cada actividad. Las anuladas no tienen efecto. El cultivo pertenece al registro histórico; la capacidad y las gallinas muestran la configuración vigente al cierre, no ocupación ni existencias estimadas. Los importes parciales no se comparan. Los lugares inactivos conservan sus resultados históricos.</p>
  </>}
 </>;
}
