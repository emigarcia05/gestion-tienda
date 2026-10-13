"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede, type Rol } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import { prismaCuidSchema } from "@/lib/validations/common";
import { createProveedorSchema, updateProveedorSchema } from "@/lib/validations/proveedor";
import {
  REVALIDATE_AYUDA_VENDEDOR_CALC,
  REVALIDATE_LISTA_PROVEEDORES_TABLERO,
} from "@/lib/gestionProductosRoutes";
import * as proveedorService from "@/services/proveedor.service";
import { z } from "zod";

function revalidateCatalogoProveedores() {
  for (const path of REVALIDATE_LISTA_PROVEEDORES_TABLERO) {
    revalidatePath(path);
  }
}

function puedeConsultarCatalogoProveedores(rol: Rol): boolean {
  return (
    puede(rol, PERMISOS.proveedores.sugeridos) ||
    puede(rol, PERMISOS.proveedores.lista) ||
    puede(rol, PERMISOS.listaPrecios.acciones.importarLista)
  );
}

export async function getProveedores() {
  const rol = await getRol();
  if (!puedeConsultarCatalogoProveedores(rol)) return [];
  return proveedorService.getProveedores();
}

/**
 * Lista únicamente los proveedores con `proveedor_mercaderia = true`.
 * Usada por /administrador/proveedores/proveedores (tabla "Lista Proveedores").
 */
export async function getProveedoresMercaderia() {
  const rol = await getRol();
  if (!puedeConsultarCatalogoProveedores(rol)) return [];
  return proveedorService.getProveedoresMercaderia();
}

/**
 * Lista únicamente los proveedores con `es_fabrica = true`.
 * Usada por Pedido A Fábrica (selector PROVEEDOR).
 */
export async function getProveedoresFabrica() {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.estadisticasProductos.acceso)) return [];
  return proveedorService.getProveedoresFabrica();
}

export async function crearProveedor(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.proveedores.acciones.nuevoProveedor)) {
    return { ok: false, error: "Sin permisos para crear proveedores." };
  }

  const raw = {
    nombre: (formData.get("nombre") as string) ?? "",
    prefijo: (formData.get("prefijo") as string) ?? "",
    whatsapp: (formData.get("whatsapp") as string) ?? "",
    coeficienteTintometrico:
      (formData.get("coeficienteTintometrico") as string) ?? "",
    plazoPago1Dias: (formData.get("plazoPago1Dias") as string) ?? "",
    plazoPago2Dias: (formData.get("plazoPago2Dias") as string) ?? "",
    plazoPago3Dias: (formData.get("plazoPago3Dias") as string) ?? "",
    plazoPago4Dias: (formData.get("plazoPago4Dias") as string) ?? "",
    tiempoEntregaEnDias:
      (formData.get("tiempoEntregaEnDias") as string) ?? "",
    proveedorMercaderia:
      (formData.get("proveedorMercaderia") as string | null) ?? "",
    esFabrica: (formData.get("esFabrica") as string | null) ?? "",
    iva: (formData.get("iva") as string | null) ?? "",
  };
  const parsed = createProveedorSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.nombre?.[0] ??
      first.proveedorMercaderia?.[0] ??
      first.esFabrica?.[0] ??
      first.prefijo?.[0] ??
      first.whatsapp?.[0] ??
      first.coeficienteTintometrico?.[0] ??
      first.plazoPago1Dias?.[0] ??
      first.plazoPago2Dias?.[0] ??
      first.plazoPago3Dias?.[0] ??
      first.plazoPago4Dias?.[0] ??
      first.tiempoEntregaEnDias?.[0] ??
      first.iva?.[0] ??
      parsed.error.issues[0]?.message ??
      "Datos inválidos.";
    return { ok: false, error: msg };
  }

  try {
    const idProveedorDuxRaw = (formData.get("idProveedorDux") as string | null) ?? "";
    const { id } = await proveedorService.createProveedor({
      ...parsed.data,
      idProveedorDux: idProveedorDuxRaw.trim() || null,
    });
    revalidateCatalogoProveedores();
    return { ok: true, data: { id } };
  } catch (e: unknown) {
    const isPrisma = e && typeof e === "object" && "code" in e;
    if (isPrisma && (e as { code: string }).code === "P2002") {
      const target = (e as { meta?: { target?: string[] } }).meta?.target;
      if (Array.isArray(target) && target.includes("prefijo"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.PREFIJO_DUPLICADO };
      if (Array.isArray(target) && target.includes("codigo_unico"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.CODIGO_UNICO_DUPLICADO };
      if (Array.isArray(target) && target.includes("nombre"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.NOMBRE_DUPLICADO };
    }
    const message = e instanceof Error ? e.message : "Error al crear el proveedor.";
    return { ok: false, error: message };
  }
}

export async function editarProveedor(id: string, formData: FormData): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.proveedores.acciones.nuevoProveedor)) {
    return { ok: false, error: "Sin permisos para editar proveedores." };
  }
  const idParsed = prismaCuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "ID de proveedor inválido." };

  const raw = {
    nombre: (formData.get("nombre") as string) ?? "",
    prefijo: (formData.get("prefijo") as string) ?? "",
    whatsapp: (formData.get("whatsapp") as string) ?? "",
    coeficienteTintometrico:
      (formData.get("coeficienteTintometrico") as string) ?? "",
    plazoPago1Dias: (formData.get("plazoPago1Dias") as string) ?? "",
    plazoPago2Dias: (formData.get("plazoPago2Dias") as string) ?? "",
    plazoPago3Dias: (formData.get("plazoPago3Dias") as string) ?? "",
    plazoPago4Dias: (formData.get("plazoPago4Dias") as string) ?? "",
    tiempoEntregaEnDias:
      (formData.get("tiempoEntregaEnDias") as string) ?? "",
    proveedorMercaderia:
      (formData.get("proveedorMercaderia") as string | null) ?? "",
    esFabrica: (formData.get("esFabrica") as string | null) ?? "",
    iva: (formData.get("iva") as string | null) ?? "",
  };
  const parsed = updateProveedorSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.nombre?.[0] ??
      first.proveedorMercaderia?.[0] ??
      first.esFabrica?.[0] ??
      first.prefijo?.[0] ??
      first.whatsapp?.[0] ??
      first.coeficienteTintometrico?.[0] ??
      first.plazoPago1Dias?.[0] ??
      first.plazoPago2Dias?.[0] ??
      first.plazoPago3Dias?.[0] ??
      first.plazoPago4Dias?.[0] ??
      first.tiempoEntregaEnDias?.[0] ??
      first.iva?.[0] ??
      parsed.error.issues[0]?.message ??
      "Datos inválidos.";
    return { ok: false, error: msg };
  }

  const idProveedorDuxRaw = (formData.get("idProveedorDux") as string | null) ?? "";
  const idProveedorDux = idProveedorDuxRaw.trim() || null;

  try {
    await proveedorService.updateProveedor({
      id: idParsed.data,
      ...parsed.data,
      idProveedorDux,
    });
    revalidateCatalogoProveedores();
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const isPrisma = e && typeof e === "object" && "code" in e;
    if (isPrisma && (e as { code: string }).code === "P2002") {
      const target = (e as { meta?: { target?: string[] } }).meta?.target;
      if (Array.isArray(target) && target.includes("prefijo"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.PREFIJO_DUPLICADO };
      if (Array.isArray(target) && target.includes("codigo_unico"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.CODIGO_UNICO_DUPLICADO };
      if (Array.isArray(target) && target.includes("nombre"))
        return { ok: false, error: proveedorService.PROVEEDOR_ERROR.NOMBRE_DUPLICADO };
    }
    const message = e instanceof Error ? e.message : "Error al editar el proveedor.";
    return { ok: false, error: message };
  }
}

export async function eliminarProveedor(id: string): Promise<ActionResult> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.proveedores.acciones.nuevoProveedor)) {
    return { ok: false, error: "Sin permisos para eliminar proveedores." };
  }
  const idParsed = prismaCuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "ID de proveedor inválido." };
  const del = await proveedorService.deleteProveedor(idParsed.data);
  if (!del.success) return { ok: false, error: del.error };
  revalidateCatalogoProveedores();
  return { ok: true, data: undefined };
}

const coeficienteBulkItemSchema = z.object({
  id: prismaCuidSchema,
  coeficienteTintometrico: z
    .number()
    .finite()
    .gt(0, "El coeficiente debe ser mayor a 0.")
    .max(999999, "El coeficiente es demasiado grande."),
});

const coeficienteBulkSchema = z
  .array(coeficienteBulkItemSchema)
  .min(1, "No hay proveedores para actualizar.")
  .max(1000, "Demasiados proveedores.");

export async function actualizarCoeficientesTintometricosAction(
  raw: unknown
): Promise<ActionResult<{ actualizados: number }>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.stock.acceso) || !(await esEditor())) {
    return { ok: false, error: "Sin permisos para editar coeficientes tintométricos." };
  }

  const parsed = coeficienteBulkSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      [...Object.values(parsed.error.flatten().fieldErrors).flat(), ...parsed.error.flatten().formErrors][0] ??
      "Datos inválidos.";
    return { ok: false, error: first };
  }

  try {
    await proveedorService.updateCoeficientesTintometricos(parsed.data);
    revalidateCatalogoProveedores();
    for (const path of REVALIDATE_AYUDA_VENDEDOR_CALC) {
      revalidatePath(path);
    }
    return { ok: true, data: { actualizados: parsed.data.length } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al actualizar coeficientes.";
    return { ok: false, error: message };
  }
}

