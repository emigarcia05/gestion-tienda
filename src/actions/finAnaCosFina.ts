"use server";

import { revalidatePath } from "next/cache";
import { requireEditorFinanzas, requireFinanzasLectura } from "@/lib/actionGates";
import { firstZodErrorMessage, fromServiceResult } from "@/lib/actionResult";
import type { ActionResult } from "@/lib/types";
import type { FinAnaCosFinaTerminalMarcaItem } from "@/lib/finAnaCosFinaTerminalesMarcas";
import type { FinAnaCosFinaPagoItem } from "@/lib/finAnaCosFinaPagos";
<<<<<<< HEAD
import type { CobrosBancoItem } from "@/lib/cobrosBancos";
=======
import type { CobrosCuotaItem } from "@/lib/cobrosCuotas";
>>>>>>> facturacion
import { actualizarFinAnaCosFinaSchema } from "@/lib/validations/finAnaCosFina";
import {
  crearFinAnaCosFinaTerminalMarcaSchema,
  editarFinAnaCosFinaTerminalMarcaSchema,
  eliminarFinAnaCosFinaTerminalMarcaSchema,
} from "@/lib/validations/finAnaCosFinaTerminalMarca";
import {
  crearFinAnaCosFinaPagoSchema,
  editarFinAnaCosFinaPagoSchema,
  eliminarFinAnaCosFinaPagoSchema,
} from "@/lib/validations/finAnaCosFinaPago";
import {
<<<<<<< HEAD
  crearCobrosBancoSchema,
  editarCobrosBancoSchema,
  eliminarCobrosBancoSchema,
} from "@/lib/validations/cobrosBancos";
=======
  crearCobrosCuotaSchema,
  editarCobrosCuotaSchema,
  eliminarCobrosCuotaSchema,
} from "@/lib/validations/cobrosCuota";
>>>>>>> facturacion
import {
  actualizarFinAnaCosFina,
  type FinAnaCosFinaItem,
} from "@/services/finAnaCosFina.service";
import {
  crearFinAnaCosFinaTerminalMarca,
  editarFinAnaCosFinaTerminalMarca,
  eliminarFinAnaCosFinaTerminalMarca,
  listarFinAnaCosFinaTerminalesMarcas,
} from "@/services/finAnaCosFinaTerminalMarca.service";
import {
  crearFinAnaCosFinaPago,
  editarFinAnaCosFinaPago,
  eliminarFinAnaCosFinaPago,
  listarFinAnaCosFinaPagos,
} from "@/services/finAnaCosFinaPago.service";
import {
<<<<<<< HEAD
  crearCobrosBanco,
  editarCobrosBanco,
  eliminarCobrosBanco,
  listarCobrosBancos,
} from "@/services/cobrosBancos.service";
=======
  crearCobrosCuota,
  editarCobrosCuota,
  eliminarCobrosCuota,
  listarCobrosCuotas,
} from "@/services/cobrosCuotas.service";
>>>>>>> facturacion
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

<<<<<<< HEAD
export async function listarCobrosBancosAction(): Promise<ActionResult<CobrosBancoItem[]>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarCobrosBancos();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudieron cargar los bancos." };
  }
}

export async function crearCobrosBancoAction(
  raw: unknown
): Promise<ActionResult<CobrosBancoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearCobrosBancoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearCobrosBanco(parsed.data);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
}

export async function editarCobrosBancoAction(
  raw: unknown
): Promise<ActionResult<CobrosBancoItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarCobrosBancoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarCobrosBanco(parsed.data);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
}

export async function eliminarCobrosBancoAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarCobrosBancoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarCobrosBanco(parsed.data.id);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
=======
function revalidateRutasEntidadesCompartidas(): void {
  revalidateRutasAnalisisMc();
  revalidatePath("/finanzas/tesoreria");
>>>>>>> facturacion
}

export async function listarFinAnaCosFinaTerminalesMarcasAction(): Promise<
  ActionResult<FinAnaCosFinaTerminalMarcaItem[]>
> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarFinAnaCosFinaTerminalesMarcas();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudieron cargar las entidades." };
  }
}

export async function crearFinAnaCosFinaTerminalMarcaAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaTerminalMarcaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearFinAnaCosFinaTerminalMarcaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearFinAnaCosFinaTerminalMarca(parsed.data);
  if (res.success) revalidateRutasEntidadesCompartidas();
  return fromServiceResult(res);
}

export async function editarFinAnaCosFinaTerminalMarcaAction(
  raw: unknown
): Promise<ActionResult<FinAnaCosFinaTerminalMarcaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarFinAnaCosFinaTerminalMarcaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarFinAnaCosFinaTerminalMarca(parsed.data);
  if (res.success) revalidateRutasEntidadesCompartidas();
  return fromServiceResult(res);
}

export async function eliminarFinAnaCosFinaTerminalMarcaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarFinAnaCosFinaTerminalMarcaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarFinAnaCosFinaTerminalMarca(parsed.data.id);
  if (res.success) revalidateRutasEntidadesCompartidas();
  return fromServiceResult(res);
}

export async function listarCobrosCuotasAction(): Promise<ActionResult<CobrosCuotaItem[]>> {
  const gate = await requireFinanzasLectura();
  if (gate) return gate;

  try {
    const data = await listarCobrosCuotas();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudieron cargar las cuotas." };
  }
}

export async function crearCobrosCuotaAction(
  raw: unknown
): Promise<ActionResult<CobrosCuotaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = crearCobrosCuotaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await crearCobrosCuota(parsed.data);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
}

export async function editarCobrosCuotaAction(
  raw: unknown
): Promise<ActionResult<CobrosCuotaItem>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = editarCobrosCuotaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await editarCobrosCuota(parsed.data);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
}

export async function eliminarCobrosCuotaAction(
  raw: unknown
): Promise<ActionResult<void>> {
  const gate = await requireEditorFinanzas();
  if (gate) return gate;

  const parsed = eliminarCobrosCuotaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: firstZodErrorMessage(parsed.error) };
  }

  const res = await eliminarCobrosCuota(parsed.data.id);
  if (res.success) revalidateRutasAnalisisMc();
  return fromServiceResult(res);
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
