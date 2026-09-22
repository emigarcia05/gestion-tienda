"use server";

import { revalidatePath } from "next/cache";
import { getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { prismaCuidSchema } from "@/lib/validations/common";
import { z } from "zod";
import { generarPdfPedido } from "@/lib/generarPdfPedido";
import { formatDdMmHhMmArgentina } from "@/lib/fechaArgentina";
import { SUCURSAL_LABEL_PEDIDO, type SucursalPedido } from "@/lib/pedidos";
import * as pedidosHistoriaService from "@/services/pedidosHistoria.service";
import * as notaCreditoNumeroService from "@/services/notaCreditoNumero.service";
import { fechaFacturaIsoSchema } from "@/services/exportRecepcionPedidoExcel.service";

/**
 * Wrapper de seguridad para Server Actions del módulo:
 *  - Garantiza que cualquier excepción no esperada (Neon, iron-session,
 *    revalidatePath, etc.) NO suba al cliente como mensaje genérico de
 *    "Server Components render…", sino como `ActionResult.error`.
 *  - Loggea un mensaje grepeable en Vercel Function Logs con el `scope`.
 */
async function ejecutarActionSegura<T>(
  scope: string,
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pedidoHistoria][action][${scope}]`, msg);
    return { ok: false, error: "Error inesperado al procesar la solicitud." };
  }
}

const marcarRegistradoSchema = z.object({
  pedidoHistoriaId: prismaCuidSchema,
  totalPedido: z.coerce
    .number()
    .finite()
    .refine((n) => n !== 0, "Total inválido."),
  fechaRecepcionIso: fechaFacturaIsoSchema,
});

const guardarRecepcionSchema = z.object({
  pedidoHistoriaId: prismaCuidSchema,
  items: z
    .array(
      z.object({
        id: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          prismaCuidSchema.optional()
        ),
        codTienda: z.string().min(1, "Cod. tienda inválido."),
        codExt: z.string().max(200).optional(),
        descripcion: z.string().max(500).optional(),
        cantPedida: z.coerce.number().int().min(0, "Cant. pedida inválida."),
        cantRecibida: z.coerce.number().int().min(-1_000_000).max(1_000_000).nullable(),
      })
    )
    .min(1, "Debe existir al menos un ítem."),
  fechaRecepcionIso: fechaFacturaIsoSchema.optional(),
});

const eliminarPedidoHistoriaSchema = z.object({
  pedidoHistoriaId: prismaCuidSchema,
});

const descargarPdfPedidoHistoriaSchema = z.object({
  pedidoHistoriaId: prismaCuidSchema,
});

/** Regenera la nota de pedido PDF desde el snapshot del historial (mismo layout que al generar). */
export async function descargarPdfPedidoHistoriaAction(
  params: unknown
): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  return ejecutarActionSegura("descargarPdfPedidoHistoria", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const parsed = descargarPdfPedidoHistoriaSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: "ID de pedido inválido." };

    const res = await pedidosHistoriaService.getPedidoHistoriaPdfPayload({
      pedidoHistoriaId: parsed.data.pedidoHistoriaId,
    });
    if (!res.success) return { ok: false, error: res.error };

    const { items, proveedorNombre, proveedorPrefijo, sucursalCodigo, generadoAt } =
      res.data;

    function sanitizeFilenamePart(s: string): string {
      return s.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
    }

    const sucursalLabel =
      SUCURSAL_LABEL_PEDIDO[sucursalCodigo as SucursalPedido] ?? sucursalCodigo;
    const pdfBuffer = generarPdfPedido(
      items,
      proveedorNombre,
      sucursalLabel,
      "",
      { fechaDocumento: generadoAt }
    );
    const prefijoProveedor = sanitizeFilenamePart(proveedorPrefijo || "");
    const fechaStr = formatDdMmHhMmArgentina(generadoAt);
    const filename = `Nota Pedido - ${prefijoProveedor} - ${fechaStr}.pdf`;
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    return { ok: true, data: { pdfBase64, filename } };
  });
}

export async function marcarPedidoHistoriaRegistradoAction(
  params: unknown
): Promise<ActionResult<void>> {
  return ejecutarActionSegura("marcarPedidoHistoriaRegistrado", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const parsed = marcarRegistradoSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };

    const res = await pedidosHistoriaService.marcarPedidoHistoriaRegistrado({
      pedidoHistoriaId: parsed.data.pedidoHistoriaId,
      totalPedido: parsed.data.totalPedido,
      fechaRecepcionIso: parsed.data.fechaRecepcionIso,
    });
    if (!res.success) return { ok: false, error: res.error };

    revalidatePath("/pedidos/historial");
    return { ok: true, data: undefined };
  });
}

export async function guardarRecepcionPedidoHistoriaAction(
  params: unknown
): Promise<ActionResult<void>> {
  return ejecutarActionSegura("guardarRecepcionPedidoHistoria", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const parsed = guardarRecepcionSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };

    const res = await pedidosHistoriaService.guardarRecepcionPedidoHistoria({
      pedidoHistoriaId: parsed.data.pedidoHistoriaId,
      items: parsed.data.items,
      fechaRecepcionIso: parsed.data.fechaRecepcionIso,
    });
    if (!res.success) return { ok: false, error: res.error };

    revalidatePath("/pedidos/historial");
    return { ok: true, data: undefined };
  });
}

export async function eliminarPedidoHistoriaAction(
  params: unknown
): Promise<ActionResult<void>> {
  return ejecutarActionSegura("eliminarPedidoHistoria", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const parsed = eliminarPedidoHistoriaSchema.safeParse(params);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };

    const res = await pedidosHistoriaService.eliminarPedidoHistoria({
      pedidoHistoriaId: parsed.data.pedidoHistoriaId,
    });
    if (!res.success) return { ok: false, error: res.error };

    revalidatePath("/pedidos/historial");
    return { ok: true, data: undefined };
  });
}

export async function listarPedidosHistoriaRecepcionadosParaNotaCreditoAction(): Promise<
  ActionResult<pedidosHistoriaService.PedidoHistoriaRecepcionadoNc[]>
> {
  return ejecutarActionSegura(
    "listarPedidosHistoriaRecepcionadosParaNotaCredito",
    async () => {
      const rol = await getRol();
      if (!puede(rol, PERMISOS.pedidos.acceso)) {
        return { ok: false, error: "Sin permisos para pedidos." };
      }

      const res =
        await pedidosHistoriaService.listarPedidosHistoriaRecepcionadosParaNotaCredito();
      if (!res.success) return { ok: false, error: res.error };
      return { ok: true, data: res.data };
    }
  );
}

export async function obtenerSiguienteNumeroNotaCreditoAction(): Promise<
  ActionResult<{ numero: string }>
> {
  return ejecutarActionSegura("obtenerSiguienteNumeroNotaCredito", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const res = await notaCreditoNumeroService.obtenerSiguienteNumeroNotaCredito();
    if (!res.success) return { ok: false, error: res.error };
    return { ok: true, data: res.data };
  });
}

export async function reservarSiguienteNumeroNotaCreditoAction(): Promise<
  ActionResult<{ numero: string }>
> {
  return ejecutarActionSegura("reservarSiguienteNumeroNotaCredito", async () => {
    const rol = await getRol();
    if (!puede(rol, PERMISOS.pedidos.acceso)) {
      return { ok: false, error: "Sin permisos para pedidos." };
    }

    const res = await notaCreditoNumeroService.reservarSiguienteNumeroNotaCredito();
    if (!res.success) return { ok: false, error: res.error };

    revalidatePath("/pedidos/historial");
    return { ok: true, data: res.data };
  });
}
