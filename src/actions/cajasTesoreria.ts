"use server";

import { revalidatePath } from "next/cache";
import { esEditor, getRol } from "@/lib/sesion";
import { PERMISOS, puede } from "@/lib/permisos";
import type { ActionResult } from "@/lib/types";
import {
  crearCajaTesoreriaSchema,
  crearFinTesoreriaEntidadSchema,
  editarCajaTesoreriaSchema,
  editarFinTesoreriaEntidadSchema,
  eliminarCajaTesoreriaSchema,
  eliminarFinTesoreriaEntidadSchema,
} from "@/lib/validations/cajasTesoreria";
import {
  crearCajaTesoreria,
  crearFinTesoreriaEntidad,
  editarCajaTesoreria,
  editarFinTesoreriaEntidad,
  eliminarCajaTesoreria,
  eliminarFinTesoreriaEntidad,
  listarCajasTesoreriaPorTipoCaja,
  listarEntidadesFinTesoreria,
  listarSucursalesTesoreria,
  type CajaTesoreriaItem,
  type SucursalTesoreriaOption,
} from "@/services/cajasTesoreria.service";
import type { FinTesoreriaEntidadItem } from "@/lib/cajasTesoreriaEntidades";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

function revalidateCajasTesoreriaPaths(): void {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/tesoreria");
}

/** Catálogo `fin_tesoreria_entidades` para alta/edición de cajas. */
export async function listarEntidadesFinTesoreriaAction(): Promise<ActionResult<FinTesoreriaEntidadItem[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }

  try {
    const items = await listarEntidadesFinTesoreria();
    return { ok: true, data: items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo listar las entidades.";
    return { ok: false, error: message };
  }
}

/** Catálogo `global_sucursales` para alta/edición de cajas. */
export async function listarSucursalesTesoreriaAction(): Promise<
  ActionResult<SucursalTesoreriaOption[]>
> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }

  try {
    const items = await listarSucursalesTesoreria();
    return { ok: true, data: items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo listar las sucursales.";
    return { ok: false, error: message };
  }
}

export async function crearFinTesoreriaEntidadAction(
  raw: unknown
): Promise<ActionResult<FinTesoreriaEntidadItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = crearFinTesoreriaEntidadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearFinTesoreriaEntidad(parsed.data.nombre);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: res.data };
}

export async function editarFinTesoreriaEntidadAction(
  raw: unknown
): Promise<ActionResult<FinTesoreriaEntidadItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = editarFinTesoreriaEntidadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarFinTesoreriaEntidad(parsed.data.id, parsed.data.nombre);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: res.data };
}

export async function eliminarFinTesoreriaEntidadAction(raw: unknown): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = eliminarFinTesoreriaEntidadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarFinTesoreriaEntidad(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: undefined };
}

/** Cajas con `tipo_caja = BANCO` (único destino permitido al **Acreditar cheque** en cuenta propia). */
export async function listarCajasTesoreriaTipoBancoAction(): Promise<ActionResult<CajaTesoreriaItem[]>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }

  try {
    const items = await listarCajasTesoreriaPorTipoCaja("BANCO");
    return { ok: true, data: items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo listar las cajas.";
    return { ok: false, error: message };
  }
}

export async function crearCajaTesoreriaAction(raw: unknown): Promise<ActionResult<CajaTesoreriaItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = crearCajaTesoreriaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearCajaTesoreria(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: res.data };
}

export async function editarCajaTesoreriaAction(raw: unknown): Promise<ActionResult<CajaTesoreriaItem>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = editarCajaTesoreriaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarCajaTesoreria(parsed.data);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: res.data };
}

export async function eliminarCajaTesoreriaAction(raw: unknown): Promise<ActionResult<void>> {
  const rol = await getRol();
  if (!puede(rol, PERMISOS.finanzas.acceso)) {
    return { ok: false, error: "Sin permisos para finanzas." };
  }
  if (!(await esEditor())) return { ok: false, error: "Sin permisos de editor." };

  const parsed = eliminarCajaTesoreriaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarCajaTesoreria(parsed.data.id);
  if (!res.success) return { ok: false, error: res.error };

  revalidateCajasTesoreriaPaths();
  return { ok: true, data: undefined };
}
