"use server";

import { revalidatePath } from "next/cache";
import { requireClientesMutacion, requireEnvios } from "@/lib/actionGates";
import type {
  ClienteItem,
  EnviosDireccionItem,
  EnviosFinalListItem,
} from "@/lib/envios";
import { FACTURACION_ROUTES } from "@/lib/facturacionRoutes";
import { REVALIDATE_ENVIOS } from "@/lib/gestionProductosRoutes";
import type { ActionResult } from "@/lib/types";
import {
  crearClienteSchema,
  crearEnviosDireccionSchema,
  crearEnviosFinalSchema,
  editarClienteSchema,
  editarEnviosDireccionSchema,
  editarEnviosFinalSchema,
  enviosFinalEntregadoSchema,
  eliminarClienteSchema,
  eliminarEnviosDireccionSchema,
  eliminarEnviosFinalSchema,
} from "@/lib/validations/envios";
import { crearCliente, editarCliente, eliminarCliente } from "@/services/clientes.service";
import {
  crearEnviosDireccion,
  editarEnviosDireccion,
  eliminarEnviosDireccion,
} from "@/services/enviosDirecciones.service";
import {
  crearEnviosFinal,
  editarEnviosFinal,
  eliminarEnviosFinal,
  marcarEnviosFinalEntregado,
} from "@/services/enviosFinal.service";

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}

function revalidateEnvios(): void {
  for (const path of REVALIDATE_ENVIOS) {
    revalidatePath(path);
  }
  revalidatePath(FACTURACION_ROUTES.factura.crear);
  revalidatePath(FACTURACION_ROUTES.clientes.lista);
  revalidatePath(FACTURACION_ROUTES.clientes.cuentaCorriente);
}

export async function crearClienteAction(raw: unknown): Promise<ActionResult<ClienteItem>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = crearClienteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await crearCliente(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearClienteAction]", e);
    return { ok: false, error: "No se pudo crear el cliente." };
  }
}

export async function editarClienteAction(raw: unknown): Promise<ActionResult<ClienteItem>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = editarClienteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await editarCliente(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[editarClienteAction]", e);
    return { ok: false, error: "No se pudo actualizar el cliente." };
  }
}

export async function eliminarClienteAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = eliminarClienteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await eliminarCliente(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[eliminarClienteAction]", e);
    return { ok: false, error: "No se pudo eliminar el cliente." };
  }
}

export async function crearEnviosDireccionAction(
  raw: unknown
): Promise<ActionResult<EnviosDireccionItem>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = crearEnviosDireccionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await crearEnviosDireccion(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearEnviosDireccionAction]", e);
    return { ok: false, error: "No se pudo crear el proyecto." };
  }
}

export async function editarEnviosDireccionAction(
  raw: unknown
): Promise<ActionResult<EnviosDireccionItem>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = editarEnviosDireccionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await editarEnviosDireccion(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[editarEnviosDireccionAction]", e);
    return { ok: false, error: "No se pudo actualizar el proyecto." };
  }
}

export async function eliminarEnviosDireccionAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireClientesMutacion();
  if (gate) return gate;
  const parsed = eliminarEnviosDireccionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await eliminarEnviosDireccion(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[eliminarEnviosDireccionAction]", e);
    return { ok: false, error: "No se pudo eliminar el proyecto." };
  }
}

export async function crearEnviosFinalAction(
  raw: unknown
): Promise<ActionResult<EnviosFinalListItem>> {
  const gate = await requireEnvios();
  if (gate) return gate;
  const parsed = crearEnviosFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await crearEnviosFinal(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[crearEnviosFinalAction]", e);
    return { ok: false, error: "No se pudo crear el envío." };
  }
}

export async function editarEnviosFinalAction(
  raw: unknown
): Promise<ActionResult<EnviosFinalListItem>> {
  const gate = await requireEnvios();
  if (gate) return gate;
  const parsed = editarEnviosFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await editarEnviosFinal(parsed.data);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[editarEnviosFinalAction]", e);
    return { ok: false, error: "No se pudo actualizar el envío." };
  }
}

export async function marcarEnviosFinalEntregadoAction(
  raw: unknown
): Promise<ActionResult<EnviosFinalListItem>> {
  const gate = await requireEnvios();
  if (gate) return gate;
  const parsed = enviosFinalEntregadoSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await marcarEnviosFinalEntregado(parsed.data.id, parsed.data.entregado);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[marcarEnviosFinalEntregadoAction]", e);
    return { ok: false, error: "No se pudo marcar el envío como entregado." };
  }
}

export async function eliminarEnviosFinalAction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireEnvios();
  if (gate) return gate;
  const parsed = eliminarEnviosFinalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodErrorMessage(parsed.error) };
  try {
    const res = await eliminarEnviosFinal(parsed.data.id);
    if (!res.success) return { ok: false, error: res.error };
    revalidateEnvios();
    return { ok: true, data: res.data };
  } catch (e) {
    console.error("[eliminarEnviosFinalAction]", e);
    return { ok: false, error: "No se pudo eliminar el envío." };
  }
}
