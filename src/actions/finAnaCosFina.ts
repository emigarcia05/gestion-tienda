"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import type { ActionResult } from "@/lib/types";
import type { FinAnaCosFinaTerminalItem } from "@/lib/finAnaCosFinaTerminales";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
import { actualizarFinAnaCosFinaSchema } from "@/lib/validations/finAnaCosFina";
import {
  crearFinAnaCosFinaTerminalSchema,
  editarFinAnaCosFinaTerminalSchema,
  eliminarFinAnaCosFinaTerminalSchema,
} from "@/lib/validations/finAnaCosFinaTerminal";
import {
  crearFinAnaCosFinaPagoSchema,
  editarFinAnaCosFinaPagoSchema,
  eliminarFinAnaCosFinaPagoSchema,
  reordenarFinAnaCosFinaPagosSchema,
} from "@/lib/validations/finAnaCosFinaPago";
import {
  actualizarFinAnaCosFina,
  type FinAnaCosFinaItem,
} from "@/services/finAnaCosFina.service";
import {
  crearFinAnaCosFinaTerminal,
  editarFinAnaCosFinaTerminal,
  eliminarFinAnaCosFinaTerminal,
  listarFinAnaCosFinaTerminales,
} from "@/services/finAnaCosFinaTerminal.service";
import {
  crearFinAnaCosFinaPago,
  editarFinAnaCosFinaPago,
  eliminarFinAnaCosFinaPago,
  listarFinAnaCosFinaPagos,
  reordenarFinAnaCosFinaPagos,
} from "@/services/finAnaCosFinaPago.service";
import {
  VTAS_COBROS_LEGACY_COSTOS_FINANCIEROS_PATH,
  VTAS_COBROS_ROUTES,
} from "@/lib/vtasCobrosRoutes";

const RUTA_COSTOS_FINANCIEROS = VTAS_COBROS_ROUTES.cxFinCobros;
const RUTA_MARGEN_CONTRIBUCION = "/finanzas/analisis-mc/margen-contribucion";

function revalidateRutasAnalisisMc(): void {
  revalidatePath(RUTA_COSTOS_FINANCIEROS);
  revalidatePath(VTAS_COBROS_LEGACY_COSTOS_FINANCIEROS_PATH);
  revalidatePath(RUTA_MARGEN_CONTRIBUCION);
}

function firstZodErrorMessage(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}): string {
  const flattened = error.flatten();
  return (
    [...Object.values(flattened.fieldErrors).flat(), ...flattened.formErrors][0] ??
    "Datos inválidos."
  );
}



export async function listarFinAnaCosFinaTerminalesAction(): Promise<
  ActionResult<FinAnaCosFinaTerminalItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarFinAnaCosFinaTerminales();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudieron cargar las terminales." };
  }
}

export async function crearFinAnaCosFinaTerminalAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaTerminalItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinAnaCosFinaTerminalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearFinAnaCosFinaTerminal(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: res.data };
}

export async function editarFinAnaCosFinaTerminalAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaTerminalItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinAnaCosFinaTerminalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarFinAnaCosFinaTerminal(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: res.data };
}

export async function eliminarFinAnaCosFinaTerminalAction(raw: unknown): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinAnaCosFinaTerminalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarFinAnaCosFinaTerminal(parsed.data.id);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: undefined };
}

export async function listarFinAnaCosFinaPagosAction(): Promise<
  ActionResult<FinAnaCosFinaPagoItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarFinAnaCosFinaPagos();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudieron cargar las formas de pago." };
  }
}

export async function crearFinAnaCosFinaPagoAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaPagoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinAnaCosFinaPagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearFinAnaCosFinaPago(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: res.data };
}

export async function editarFinAnaCosFinaPagoAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaPagoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinAnaCosFinaPagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarFinAnaCosFinaPago(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: res.data };
}

export async function eliminarFinAnaCosFinaPagoAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinAnaCosFinaPagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarFinAnaCosFinaPago(parsed.data.id);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: undefined };
}

export async function reordenarFinAnaCosFinaPagosAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaPagoItem[]>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = reordenarFinAnaCosFinaPagosSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await reordenarFinAnaCosFinaPagos(parsed.data);
  if (!res.success) {
    return { ok: false, error: res.error };
  }

  revalidateRutasAnalisisMc();
  return { ok: true, data: res.data };
}

export async function actualizarFinAnaCosFinaAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = actualizarFinAnaCosFinaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  try {
    const data = await actualizarFinAnaCosFina(parsed.data);
    revalidateRutasAnalisisMc();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo actualizar el costo financiero." };
  }
}
