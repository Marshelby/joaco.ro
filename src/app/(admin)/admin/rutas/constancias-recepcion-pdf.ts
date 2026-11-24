type CantidadConstancia = { cantidad: string; fuente: string };

export type PedidoConstancia = {
  id: string;
  numero: string;
  destinatario: string;
  direccion: string;
  productos: readonly (CantidadConstancia & {
    nombre: string;
    presentacion: string | null;
    conPrecios: CantidadConstancia & { precioUnitario: string; importe: string };
  })[];
  resumen: readonly (readonly [string, string])[];
};

// Medidas A4 en puntos PDF. El lienzo se reutiliza a 288 ppp.
const ancho = 595.28;
const alto = 841.89;
const margen = 36;
const anchoTexto = ancho - 2 * margen;
const mitad = alto / 2;
const altoMedia = mitad - margen - 14;
const altoCompleta = alto - 2 * margen;
const escala = 4;

type Bloque = { alto: number; dibujar: (y: number) => void };
type Pagina = { superior: Bloque[]; inferior?: Bloque[]; lineaDeCorte?: boolean };

export async function generarPdfConstancias(pedidos: readonly PedidoConstancia[], fecha: string, conPrecios = false) {
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("Lienzo no disponible");
  const ctx = contexto;
  ctx.scale(lienzo.width / ancho, lienzo.height / alto);
  ctx.textBaseline = "top";

  const derecha = ancho - margen;
  const columnas = conPrecios
    ? [margen, margen + 218, margen + 309, margen + 422, derecha]
    : [margen, margen + 310, derecha];

  function texto(valor: string, tamano = 10, negrita = false, {
    x = margen, anchoMax = anchoTexto, derecha = false, color = "#202020",
  } = {}): Bloque[] {
    const fuente = `${negrita ? "bold" : "normal"} ${tamano}px Arial, sans-serif`;
    ctx.font = fuente;
    const lineas: string[] = [];
    let linea = "";
    for (const palabra of valor.trim().split(/\s+/u)) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(candidata).width <= anchoMax) {
        linea = candidata;
        continue;
      }
      if (linea) lineas.push(linea);
      linea = "";
      for (const letra of palabra) {
        if (linea && ctx.measureText(linea + letra).width > anchoMax) {
          lineas.push(linea);
          linea = "";
        }
        linea += letra;
      }
    }
    if (linea) lineas.push(linea);
    return lineas.map(linea => ({
      alto: tamano + 3,
      dibujar(y) {
        ctx.font = fuente;
        ctx.fillStyle = color;
        ctx.textAlign = derecha ? "right" : "left";
        ctx.fillText(linea, derecha ? x + anchoMax : x, y);
      },
    }));
  }

  function altura(bloques: Bloque[]) {
    return bloques.reduce((suma, bloque) => suma + bloque.alto, 0);
  }

  function dibujar(bloques: Bloque[], y: number) {
    for (const bloque of bloques) {
      bloque.dibujar(y);
      y += bloque.alto;
    }
  }

  function rectangulo(x: number, y: number, ancho: number, alto: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, ancho, alto);
  }

  function regla(x1: number, x2: number, y: number, corte = false) {
    ctx.strokeStyle = corte ? "#454545" : "#929292";
    ctx.lineWidth = corte ? 0.85 : 0.5;
    ctx.setLineDash(corte ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  function celda(valor: string, columna: number, negrita = false, tamano = 10) {
    return texto(valor, tamano, negrita, {
      x: columnas[columna] + 8,
      anchoMax: columnas[columna + 1] - columnas[columna] - 16,
      derecha: columna >= 1,
    });
  }

  function fila(celdas: Bloque[][], encabezado = false): Bloque {
    const alto = Math.max(13, ...celdas.map(altura)) + 8;
    return {
      alto,
      dibujar(y) {
        if (encabezado) {
          rectangulo(margen, y, anchoTexto, alto, "#efefef");
          regla(margen, derecha, y);
        }
        for (const celda of celdas) dibujar(celda, y + 4);
        regla(margen, derecha, y + alto);
        for (const x of columnas) rectangulo(x - 0.25, y, 0.5, alto, "#929292");
      },
    };
  }

  const franja: Bloque = {
    alto: 8,
    dibujar(y) {
      rectangulo(margen, y, anchoTexto, 2, "#454545");
    },
  };
  const espacio: Bloque = { alto: 6, dibujar() {} };
  const titulosTabla = fila([
    celda("Producto", 0, true),
    celda("Cantidad", 1, true, 9),
    ...(conPrecios ? [celda("Precio unitario", 2, true, 9), celda("Importe", 3, true, 9)] : []),
  ], true);

  function resumenDePrecios(resumen: PedidoConstancia["resumen"]): Bloque {
    const x = derecha - 230;
    const filas = resumen.map(([etiqueta, valor], indice) => {
      const total = indice === resumen.length - 1;
      const rotulo = texto(etiqueta, 10, total, { x: x + 8, anchoMax: 117 });
      const importe = texto(valor, 10, total, { x: x + 133, anchoMax: 89, derecha: true });
      const altoFila = Math.max(altura(rotulo), altura(importe)) + 4;
      return {
        alto: altoFila,
        dibujar(y: number) {
          if (total) {
            rectangulo(x, y, derecha - x, altoFila, "#efefef");
            regla(x, derecha, y);
          }
          dibujar(rotulo, y + 2);
          dibujar(importe, y + 2);
        },
      };
    });
    return { alto: espacio.alto + altura(filas), dibujar: y => dibujar(filas, y + espacio.alto) };
  }

  const declaracion = texto("Declaro haber recibido los productos y cantidades indicados, conforme y sin observaciones, salvo las diferencias u observaciones anotadas a continuación.", 9);
  const observaciones = texto("Observaciones o diferencias (anotar antes de firmar)", 10, true, { x: margen + 8 });
  const campos = [
    { x: margen, y: 76, ancho: 268, etiqueta: "Nombre de quien recibe" },
    { x: margen + 284, y: 76, ancho: anchoTexto - 284, etiqueta: "Firma" },
    { x: margen, y: 108, ancho: 155, etiqueta: "Fecha real de recepción" },
    { x: margen + 171, y: 108, ancho: 155, etiqueta: "Hora real de recepción" },
  ].map(campo => ({
    ...campo,
    rotulo: texto(campo.etiqueta, 9, false, { x: campo.x, anchoMax: campo.ancho, color: "#454545" }),
  }));
  const recepcion: Bloque = {
    alto: 8 + altura(declaracion) + 124,
    dibujar(y) {
      dibujar(declaracion, y + 8);
      const inicio = y + 8 + altura(declaracion);
      rectangulo(margen, inicio + 3, anchoTexto, 17, "#f1f1f1");
      dibujar(observaciones, inicio + 6);
      for (const desplazamiento of [36, 52]) regla(margen, derecha, inicio + desplazamiento);
      for (const campo of campos) {
        regla(campo.x, campo.x + campo.ancho, inicio + campo.y);
        dibujar(campo.rotulo, inicio + campo.y + 4);
      }
    },
  };

  const paginas: Pagina[] = [];
  let superior: Bloque[] | undefined;
  for (const pedido of pedidos) {
    const introduccion = [
      franja,
      ...texto("HIDRO LEUFÚ", 11, true, { color: "#454545" }),
      ...texto("Constancia de recepción de pedido", 16, true),
      ...texto(pedido.destinatario, 18, true),
      ...texto(`Pedido ${pedido.numero}`, 10, true),
      ...texto(`Fecha programada: ${fecha}`),
      ...texto(`Dirección de entrega: ${pedido.direccion}`),
      espacio,
    ];
    const identificacion = texto(`HIDRO LEUFÚ · Pedido ${pedido.numero} · Continuación`, 11, true);
    const continuacion = [
      franja,
      ...(identificacion.length === 1 ? identificacion : texto("HIDRO LEUFÚ · Continuación", 11, true)),
      espacio,
    ];

    const cantidades = pedido.productos.map(producto => conPrecios ? producto.conPrecios : producto);
    const tienePreparacion = cantidades.some(producto => producto.fuente === "Preparación confirmada");
    const tieneOriginal = cantidades.some(producto => producto.fuente === "Pedido original");
    const tieneEntrega = cantidades.some(producto => producto.fuente === "Cantidad entregada");
    const leyenda = tieneEntrega ? "Cantidades entregadas según registro" : tienePreparacion
      ? "* Preparación confirmada" + (tieneOriginal ? " · Sin asterisco: pedido original" : "")
      : tieneOriginal ? "Cantidades del pedido original" : "";
    const encabezadoTabla = [...texto(leyenda, 9, false, { color: "#454545" }), titulosTabla];
    // Una fila habitual queda entera. Las celdas excepcionalmente largas se
    // dividen por líneas y conservan su columna en la página siguiente.
    const maximoLineas = Math.floor((altoCompleta - altura(continuacion) - altura(encabezadoTabla) - 8) / 13);
    const filas = pedido.productos.flatMap((producto, indice) => {
      const { cantidad, fuente } = cantidades[indice];
      const preparada = fuente === "Preparación confirmada";
      const celdas = [
        celda(producto.nombre, 0, true),
        celda(preparada ? `* ${cantidad}` : cantidad, 1, true),
      ];
      if (!preparada && fuente !== "Pedido original" && fuente !== "Cantidad entregada") {
        celdas[1].push(...celda(fuente, 1));
      }
      if (conPrecios) {
        celdas.push(celda(producto.conPrecios.precioUnitario, 2), celda(producto.conPrecios.importe, 3));
      }
      const lineas = Math.max(1, ...celdas.map(celda => celda.length));
      const partes: Bloque[] = [];
      for (let inicio = 0; inicio < lineas; inicio += maximoLineas) {
        partes.push(fila(celdas.map(celda => celda.slice(inicio, inicio + maximoLineas))));
      }
      return partes;
    });
    if (!filas.length) filas.push(fila([celda("Sin productos registrados", 0)]));

    const cierre = conPrecios ? [resumenDePrecios(pedido.resumen), recepcion] : [recepcion];
    const bloques = [...introduccion, ...encabezadoTabla, ...filas, ...cierre];
    if (altura(bloques) <= altoMedia) {
      if (superior) {
        paginas.push({ superior, inferior: bloques, lineaDeCorte: true });
        superior = undefined;
      } else {
        superior = bloques;
      }
      continue;
    }

    if (superior) paginas.push({ superior, lineaDeCorte: true });
    superior = undefined;
    let hoja: Bloque[] = [];
    let ocupado = 0;
    function agregar(bloques: Bloque[]) {
      const alto = altura(bloques);
      if (ocupado + alto > altoCompleta) {
        paginas.push({ superior: hoja });
        hoja = [...continuacion];
        ocupado = altura(hoja);
      }
      hoja.push(...bloques);
      ocupado += alto;
    }

    for (const bloque of introduccion) agregar([bloque]);
    let tablaEnHoja = false;
    for (const bloque of filas) {
      if (!tablaEnHoja || ocupado + bloque.alto > altoCompleta) {
        agregar([...encabezadoTabla, bloque]);
        tablaEnHoja = true;
      } else {
        agregar([bloque]);
      }
    }
    agregar(cierre);
    paginas.push({ superior: hoja });
  }
  if (superior) paginas.push({ superior, lineaDeCorte: true });

  const pdf = new PdfConstancias(paginas.length);
  for (const [indice, pagina] of paginas.entries()) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.fillStyle = "#14191e";
    dibujar(pagina.superior, margen);
    if (pagina.lineaDeCorte) regla(margen, ancho - margen, mitad, true);
    if (pagina.inferior) dibujar(pagina.inferior, mitad + 14);
    const imagen = await new Promise<Blob>((resolve, reject) => {
      lienzo.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo dibujar la página")), "image/jpeg", 0.93);
    });
    pdf.agregarPagina(indice, imagen, lienzo.width, lienzo.height);
  }
  return pdf.finalizar();
}

// Cada página se incrusta como JPEG. Los offsets se cuentan en bytes, incluyendo los datos binarios.
class PdfConstancias {
  private partes: BlobPart[] = [];
  private offsets = [0];
  private longitud = 0;

  constructor(paginas: number) {
    this.escribir("%PDF-1.4\n");
    this.escribir(new Blob([new Uint8Array([37, 226, 227, 207, 211, 10])]));
    this.objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
    const hijos = Array.from({ length: paginas }, (_, indice) => `${3 + indice * 3} 0 R`).join(" ");
    this.objeto(2, `<< /Type /Pages /Count ${paginas} /Kids [${hijos}] >>`);
  }

  private escribir(parte: string | Blob) {
    this.partes.push(parte);
    this.longitud += typeof parte === "string" ? parte.length : parte.size;
  }

  private objeto(id: number, contenido: string, imagen?: Blob) {
    this.offsets[id] = this.longitud;
    this.escribir(`${id} 0 obj\n${contenido}`);
    if (imagen) {
      this.escribir("stream\n");
      this.escribir(imagen);
      this.escribir("\nendstream");
    }
    this.escribir("\nendobj\n");
  }

  agregarPagina(indice: number, imagen: Blob, pixelesX: number, pixelesY: number) {
    const id = 3 + indice * 3;
    this.objeto(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ancho} ${alto}] /Resources << /XObject << /Hoja ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    this.objeto(id + 1, `<< /Type /XObject /Subtype /Image /Width ${pixelesX} /Height ${pixelesY} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagen.size} >>\n`, imagen);
    const contenido = `q ${ancho} 0 0 ${alto} 0 0 cm /Hoja Do Q\n`;
    this.objeto(id + 2, `<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`);
  }

  finalizar() {
    const inicio = this.longitud;
    this.escribir(`xref\n0 ${this.offsets.length}\n0000000000 65535 f \n`);
    for (const offset of this.offsets.slice(1)) this.escribir(`${String(offset).padStart(10, "0")} 00000 n \n`);
    this.escribir(`trailer\n<< /Size ${this.offsets.length} /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`);
    return new Blob(this.partes, { type: "application/pdf" });
  }
}
