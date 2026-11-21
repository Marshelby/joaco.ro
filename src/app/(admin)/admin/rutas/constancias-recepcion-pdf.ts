export type PedidoConstancia = {
  id: string;
  numero: string;
  destinatario: string;
  direccion: string;
  productos: readonly { nombre: string; presentacion: string | null; cantidad: string; fuente: string }[];
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

export async function generarPdfConstancias(pedidos: readonly PedidoConstancia[], fecha: string) {
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("Lienzo no disponible");
  const ctx = contexto;
  ctx.scale(lienzo.width / ancho, lienzo.height / alto);
  ctx.textBaseline = "top";

  function tipografia(tamano: number, negrita: boolean) {
    return `${negrita ? "bold" : "normal"} ${tamano}px Arial, sans-serif`;
  }

  function texto(valor: string, tamano = 11, negrita = false): Bloque[] {
    const fuente = tipografia(tamano, negrita);
    ctx.font = fuente;
    const lineas: string[] = [];
    let linea = "";
    for (const palabra of valor.trim().split(/\s+/u)) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(candidata).width <= anchoTexto) {
        linea = candidata;
        continue;
      }
      if (linea) lineas.push(linea);
      linea = "";
      for (const letra of palabra) {
        if (ctx.measureText(linea + letra).width > anchoTexto) {
          lineas.push(linea);
          linea = "";
        }
        linea += letra;
      }
    }
    if (linea) lineas.push(linea);
    return lineas.map(linea => ({
      alto: tamano + 4,
      dibujar(y) {
        ctx.font = fuente;
        ctx.fillText(linea, margen, y);
      },
    }));
  }

  function regla(x1: number, x2: number, y: number, punteada = false) {
    ctx.strokeStyle = "#606b73";
    ctx.lineWidth = 0.65;
    ctx.setLineDash(punteada ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  const recepcion: Bloque = {
    alto: 152,
    dibujar(y) {
      ctx.font = tipografia(11, false);
      ctx.fillText("Observaciones o diferencias (anotar antes de firmar)", margen, y + 5);
      for (const desplazamiento of [31, 49, 67]) regla(margen, ancho - margen, y + desplazamiento);
      const centro = ancho / 2;
      regla(margen, centro - 10, y + 99);
      regla(centro + 10, ancho - margen, y + 99);
      ctx.fillText("Nombre de quien recibe", margen, y + 103);
      ctx.fillText("Firma", centro + 10, y + 103);
      regla(margen, centro - 10, y + 135);
      regla(centro + 10, ancho - margen, y + 135);
      ctx.fillText("Fecha real de recepción", margen, y + 139);
      ctx.fillText("Hora real de recepción", centro + 10, y + 139);
    },
  };

  const paginas: Pagina[] = [];
  let superior: Bloque[] | undefined;
  for (const pedido of pedidos) {
    const bloques = [
      ...texto("HIDRO LEUFÚ", 13, true),
      ...texto("Constancia de recepción de pedido", 14, true),
      ...texto(pedido.destinatario, 20, true),
      ...texto(`Pedido ${pedido.numero}  ·  Fecha programada: ${fecha}`),
      ...texto(`Dirección de entrega: ${pedido.direccion}`),
      ...texto("Productos y cantidades previstas para entregar", 12, true),
      ...pedido.productos.flatMap(producto => texto(
        [producto.nombre, producto.presentacion, producto.cantidad, producto.fuente].filter(Boolean).join(" · "),
      )),
      ...(!pedido.productos.length ? texto("Sin productos registrados") : []),
    ];
    const declaracion = texto("Declaro haber recibido los productos y cantidades indicados, conforme y sin observaciones, salvo las diferencias u observaciones anotadas a continuación");
    const firma: Bloque = {
      alto: 8 + declaracion.reduce((suma, bloque) => suma + bloque.alto, 0) + recepcion.alto,
      dibujar(y) {
        y += 8;
        for (const bloque of declaracion) {
          bloque.dibujar(y);
          y += bloque.alto;
        }
        recepcion.dibujar(y);
      },
    };
    bloques.push(firma);

    if (bloques.reduce((suma, bloque) => suma + bloque.alto, 0) <= altoMedia) {
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
    for (const bloque of bloques) {
      if (ocupado + bloque.alto > altoCompleta) {
        paginas.push({ superior: hoja });
        hoja = texto(`HIDRO LEUFÚ · Pedido ${pedido.numero} · Continuación`, 13, true);
        ocupado = hoja.reduce((suma, encabezado) => suma + encabezado.alto, 0);
      }
      hoja.push(bloque);
      ocupado += bloque.alto;
    }
    paginas.push({ superior: hoja });
  }
  if (superior) paginas.push({ superior, lineaDeCorte: true });

  function dibujar(bloques: Bloque[], y: number) {
    for (const bloque of bloques) {
      bloque.dibujar(y);
      y += bloque.alto;
    }
  }

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
