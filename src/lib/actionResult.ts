import type { ZodError } from "zod";
import type { ActionResult } from "@/lib/types";
import type { ServiceResult } from "@/types/service.types";

/** Primer mensaje de `ZodError.issues` (`flatten()` en Zod 4 no tipa `string`). */
export function firstZodErrorMessage(
  error: ZodError,
  fallback = "Datos inválidos."
): string {
  return error.issues[0]?.message ?? fallback;
}

/** Fallo de Action listo para `return` tras `safeParse` fallido. */
export function zodFail(
  error: ZodError,
  fallback = "Datos inválidos."
): Extract<ActionResult<never>, { ok: false }> {
  return { ok: false, error: firstZodErrorMessage(error, fallback) };
}

/** Traduce `ServiceResult` → `ActionResult` sin cambiar el mensaje de error. */
export function fromServiceResult<T>(res: ServiceResult<T>): ActionResult<T> {
  if (!res.success) {
    return { ok: false, error: res.error };
  }
  return { ok: true, data: res.data };
}
