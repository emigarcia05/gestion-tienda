import { fmtCantidad, fmtPrecio } from "@/lib/format";
import { textoHorarioSucursalDesdeDb } from "@/lib/horarioSucursal";
import { prisma } from "@/lib/prisma";
import { encontrarIdListaGeneralPxListas } from "@/lib/pxListasPreciosCategoria";
import {
  armarPedidoSugerencia,
  cerrarBorradorSugerencia,
  consultaPideSucursal,
  puntajeDescripcion,
  tokensConsultaCliente,
  type HechoWhatsappIa,
  type TurnoWhatsappIa,
} from "@/lib/whatsapp/ia/armado";
import { completarWhatsappIa } from "@/lib/whatsapp/ia/completar";
import {
  WHATSAPP_IA_MAX_MENSAJES,
  WHATSAPP_IA_MAX_NOTAS,
  WHATSAPP_IA_MAX_PRODUCTOS,
} from "@/lib/whatsapp/ia/limites";
import { clavesConversacionWhatsapp, telefonoWhatsappCanonico } from "@/lib/whatsapp/telefono";
import {
  buildMapSaldoStockItemsSucursales,
  claveSaldoStock,
} from "@/services/stockMovimientos.service";
import type { ServiceResult } from "@/types/service.types";

export type SugerenciaWhatsappIa = {
  texto: string;
};

function lineaProducto(input: {
  descripcion: string;
  precio: number | null;
  stock: string;
}): string {
  const precio = input.precio == null ? "sin dato" : `$${fmtPrecio(input.precio)}`;
  return `Producto: ${input.descripcion}. Precio lista: ${precio}. Stock: ${input.stock}.`;
}

async function hechosDeProductos(tokens: string[]): Promise<HechoWhatsappIa[]> {
  if (tokens.length === 0) return [];

  const [filas, listas, sucursales] = await Promise.all([
    prisma.prodPropio.findMany({
      where: {
        habilitado: true,
        AND: [
          { descripcionTienda: { not: null } },
          { descripcionTienda: { not: "" } },
          {
            OR: tokens.map((token) => ({
              descripcionTienda: { contains: token, mode: "insensitive" as const },
            })),
          },
        ],
      },
      select: { codTienda: true, descripcionTienda: true },
      orderBy: { descripcionTienda: "asc" },
      take: 24,
    }),
    prisma.prodPropioListaPrecioNombre.findMany({
      select: { idLista: true, nombreLista: true },
    }),
    prisma.sucursal.findMany({
      select: { id: true, codigo: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const rankeadas = filas
    .map((fila) => {
      const descripcion = (fila.descripcionTienda ?? "").trim();
      return {
        codTienda: fila.codTienda,
        descripcion,
        puntaje: puntajeDescripcion(descripcion, tokens),
      };
    })
    .filter((fila) => fila.puntaje > 0 && fila.descripcion.length > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.descripcion.localeCompare(b.descripcion, "es"))
    .slice(0, WHATSAPP_IA_MAX_PRODUCTOS);

  if (rankeadas.length === 0) return [];

  const codigos = rankeadas.map((fila) => fila.codTienda);
  const locales = sucursales.filter((suc) => suc.codigo.toLowerCase() !== "corporativo");
  const idLista = encontrarIdListaGeneralPxListas(listas);
  const [precios, saldos] = await Promise.all([
    idLista == null
      ? Promise.resolve([])
      : prisma.prodPropioListaPrecio.findMany({
          where: { idLista, codTienda: { in: codigos } },
          select: { codTienda: true, precio: true },
        }),
    buildMapSaldoStockItemsSucursales(
      codigos,
      locales.map((suc) => suc.id)
    ),
  ]);

  const precioPorCod = new Map<string, number>();
  for (const precio of precios) {
    const n = Number(precio.precio);
    if (Number.isFinite(n) && n > 0) precioPorCod.set(precio.codTienda, n);
  }

  return rankeadas.map((fila) => {
    const stock =
      locales.length === 0
        ? "sin dato"
        : locales
            .map((suc) => {
              const saldo = saldos.get(claveSaldoStock(fila.codTienda, suc.id)) ?? 0;
              return `${suc.nombre} ${fmtCantidad(saldo)}`;
            })
            .join(", ");
    return {
      origen: "producto" as const,
      texto: lineaProducto({
        descripcion: fila.descripcion,
        precio: precioPorCod.get(fila.codTienda) ?? null,
        stock,
      }),
    };
  });
}

async function hechosDeSucursales(): Promise<HechoWhatsappIa[]> {
  const sucursales = await prisma.sucursal.findMany({
    select: {
      codigo: true,
      nombre: true,
      direccion: true,
      whatsapp: true,
      horario: true,
    },
    orderBy: { nombre: "asc" },
  });

  const hechos: HechoWhatsappIa[] = [];
  for (const suc of sucursales) {
    if (suc.codigo.toLowerCase() === "corporativo") continue;
    const partes = [`Sucursal ${suc.nombre}.`];
    const direccion = (suc.direccion ?? "").replace(/\s+/g, " ").trim();
    const horario = textoHorarioSucursalDesdeDb(suc.horario)?.replace(/\s+/g, " ").trim() ?? "";
    const telefono = (suc.whatsapp ?? "").trim();
    if (direccion) partes.push(`Dirección: ${direccion}.`);
    if (horario) partes.push(`Horario: ${horario}.`);
    if (telefono) partes.push(`Teléfono: ${telefono}.`);
    if (partes.length === 1) continue;
    hechos.push({ origen: "sucursal", texto: partes.join(" ").slice(0, 400) });
  }
  return hechos;
}

/**
 * Notas activas de todo el negocio y de este chat.
 * La carga desde la pantalla queda para más adelante: esta lectura ya está.
 */
async function hechosDeNotas(telefonos: string[]): Promise<HechoWhatsappIa[]> {
  const notas = await prisma.whatsappIaContexto.findMany({
    where: {
      activo: true,
      OR: [{ alcance: "NEGOCIO" }, { alcance: "CHAT", telefono: { in: telefonos } }],
    },
    select: { titulo: true, texto: true },
    orderBy: { createdAt: "desc" },
    take: WHATSAPP_IA_MAX_NOTAS,
  });

  const hechos: HechoWhatsappIa[] = [];
  for (const nota of notas) {
    const titulo = nota.titulo.trim();
    const texto = nota.texto.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!titulo || !texto) continue;
    hechos.push({ origen: "nota", texto: `Nota ${titulo}: ${texto}` });
  }
  return hechos;
}

/**
 * Redacta un borrador con los últimos 10 mensajes y los hechos que coinciden.
 * Lo guarda con el consumo de tokens. No llama a Meta.
 */
export async function sugerirRespuestaWhatsappIa(
  telefonoRaw: string
): Promise<ServiceResult<SugerenciaWhatsappIa>> {
  const claves = clavesConversacionWhatsapp(telefonoRaw);
  const telefono = telefonoWhatsappCanonico(telefonoRaw) ?? claves?.bsuid ?? null;
  if (!claves || !telefono) return { success: false, error: "El teléfono no es válido." };

  try {
    const filas = await prisma.whatsappPruebaMensaje.findMany({
      where: claves.bsuid
        ? { OR: [{ telefono: { in: claves.telefonos } }, { bsuid: claves.bsuid }] }
        : { telefono: { in: claves.telefonos } },
      orderBy: { createdAt: "desc" },
      take: WHATSAPP_IA_MAX_MENSAJES,
      select: { id: true, direccion: true, cuerpo: true },
    });
    const cronologicos = filas.slice().reverse();
    const entrantes = cronologicos.filter((fila) => fila.direccion === "ENTRANTE");
    if (entrantes.length === 0) {
      return { success: false, error: "No hay un mensaje del cliente para responder." };
    }

    const textosCliente = entrantes
      .map((fila) => fila.cuerpo)
      .slice()
      .reverse();
    const tokens = tokensConsultaCliente(textosCliente);
    const [productos, sucursales, notas] = await Promise.all([
      hechosDeProductos(tokens),
      consultaPideSucursal(textosCliente) ? hechosDeSucursales() : Promise.resolve([]),
      hechosDeNotas(claves.telefonos),
    ]);

    const turnos: TurnoWhatsappIa[] = cronologicos.map((fila) => ({
      rol: fila.direccion === "ENTRANTE" ? "cliente" : "tienda",
      texto: fila.cuerpo,
    }));
    const pedido = armarPedidoSugerencia({
      turnos,
      hechos: [...notas, ...productos, ...sucursales],
    });
    const modelo = await completarWhatsappIa({ system: pedido.system, user: pedido.user });
    if (!modelo.success) return modelo;

    const texto = cerrarBorradorSugerencia(modelo.data.texto, pedido.hechosTexto);
    if (!texto) return { success: false, error: "El modelo no devolvió un texto." };

    const ancla = entrantes[entrantes.length - 1]?.id ?? null;
    await prisma.whatsappIaSugerencia.create({
      data: {
        telefono,
        mensajeAnclaId: ancla,
        cuerpo: texto,
        modelo: modelo.data.modelo,
        tokensEntrada: modelo.data.tokensEntrada,
        tokensSalida: modelo.data.tokensSalida,
        tokensTotal: modelo.data.tokensTotal,
      },
    });

    return { success: true, data: { texto } };
  } catch (e) {
    console.error("[whatsappIa][sugerir]", e instanceof Error ? e.name : "error");
    return { success: false, error: "No se pudo redactar la sugerencia." };
  }
}
