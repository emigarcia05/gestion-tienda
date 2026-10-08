import { z } from "zod";
import {
  PLAZOS_PAGO_DIAS_PERMITIDOS,
  PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL,
} from "@/lib/comprobanteCuotasPlazoPago";

const whatsappSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim().replace(/\D/g, ""))
  .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 15), "WhatsApp: 10 a 15 dígitos (internacional sin +).")
  .transform((v) => (v === "" ? null : v));

const coeficienteTintometricoSchema = z
  .string()
  .optional()
  .default("1")
  .transform((s) => (s ?? "").trim())
  .transform((s) => (s === "" ? "1" : s))
  .transform((s) => s.replace(/\s+/g, "").replace(",", "."))
  .refine((s) => /^(\d+)(\.\d{1,6})?$/.test(s), "Coef. Tintométrico inválido (hasta 6 decimales).")
  .transform((s) => Number(s))
  .refine((n) => Number.isFinite(n) && n > 0, "Coef. Tintométrico debe ser mayor a 0.")
  .refine((n) => n <= 1_000_000, "Coef. Tintométrico fuera de rango.");

const PLAZOS_PAGO_PERMITIDOS = new Set<number>(PLAZOS_PAGO_DIAS_PERMITIDOS);
const PLAZOS_PAGO_MENSAJE = `Solo se permiten ${PLAZOS_PAGO_DIAS_PERMITIDOS_LABEL}.`;

const plazoPagoSlotSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim())
  .transform((s) => (s === "" ? null : s))
  .superRefine((s, ctx) => {
    if (s === null) return;
    const n = Number.parseInt(s, 10);
    if (!Number.isFinite(n) || !PLAZOS_PAGO_PERMITIDOS.has(n) || String(n) !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PLAZOS_PAGO_MENSAJE,
      });
    }
  })
  .transform((s) => (s === null ? null : Number.parseInt(s, 10)));

/** Plan de pago proveedor: 1.º obligatorio, 2–4 opcionales, orden creciente. */
export const planPlazosProveedorFormSchema = z
  .object({
    plazoPago1Dias: z
      .string()
      .transform((s) => (s ?? "").trim())
      .refine((s) => s !== "", "El 1.er plazo de pago es obligatorio.")
      .pipe(
        z
          .string()
          .refine((s) => {
            const n = Number.parseInt(s, 10);
            return Number.isFinite(n) && PLAZOS_PAGO_PERMITIDOS.has(n) && String(n) === s;
          }, PLAZOS_PAGO_MENSAJE)
          .transform((s) => Number.parseInt(s, 10))
      ),
    plazoPago2Dias: plazoPagoSlotSchema,
    plazoPago3Dias: plazoPagoSlotSchema,
    plazoPago4Dias: plazoPagoSlotSchema,
  })
  .superRefine((data, ctx) => {
    const seq = [
      data.plazoPago1Dias,
      data.plazoPago2Dias,
      data.plazoPago3Dias,
      data.plazoPago4Dias,
    ];
    let last: number | null = null;
    for (let i = 0; i < seq.length; i++) {
      const cur = seq[i] ?? null;
      if (cur == null) {
        for (let j = i + 1; j < seq.length; j++) {
          if (seq[j] != null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "No puede haber un plazo posterior si falta uno intermedio.",
              path: [`plazoPago${j + 1}Dias`],
            });
            return;
          }
        }
        return;
      }
      if (last != null && cur <= last) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los plazos deben ir en orden creciente.",
          path: [`plazoPago${i + 1}Dias`],
        });
        return;
      }
      last = cur;
    }
  });

/** @deprecated Usar planPlazosProveedorFormSchema. Compat lectura CSV legacy en migraciones. */
export const plazosPagosSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim())
  .transform((s) => (s === "" ? null : s));

/**
 * Flag "Proveedor Mercadería" desde el form (hidden `si` / `no`).
 * Obligatorio en alta y edición: no se infiere un default si falta el valor.
 */
export const proveedorMercaderiaFormSchema = z
  .string()
  .transform((s) => (s ?? "").trim().toLowerCase())
  .refine((s) => s === "si" || s === "no", "Seleccioná SI o NO en Proveedor Mercadería.")
  .transform((s) => s === "si");

/**
 * Flag "Es Fábrica" desde el form (hidden `si` / `no`).
 * Obligatorio en alta y edición.
 */
export const esFabricaFormSchema = z
  .string()
  .transform((s) => (s ?? "").trim().toLowerCase())
  .refine((s) => s === "si" || s === "no", "Seleccioná SI o NO en Es Fábrica.")
  .transform((s) => s === "si");

/**
 * Política de IVA del proveedor desde el form. Reutiliza el módulo
 * compartido `@/lib/validations/iva` (la fuente de verdad para los 3
 * valores del enum Postgres `IvaProveedor`); acá se mantienen los aliases
 * históricos para compatibilidad con call sites (`ProveedorForm`,
 * `crearProveedor`, `editarProveedor`, etc.).
 */
import {
  ivaPoliticaFormSchema,
  type IvaValue as IvaValueShared,
} from "@/lib/validations/iva";

export type IvaProveedorValue = IvaValueShared;
export const ivaProveedorFormSchema = ivaPoliticaFormSchema;

/** Prefijo opcional: vacío → null; si hay texto, exactamente 3 letras A-Z. */
export const prefijoProveedorOpcionalSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim().toUpperCase())
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || /^[A-Z]{3}$/.test(s), "Si completás prefijo, deben ser exactamente 3 letras (A-Z).");

/**
 * Tiempo de entrega en días desde el form.
 * Vacío → `null`; si hay valor, entero ≥ 0 y ≤ 999.
 */
export const tiempoEntregaEnDiasSchema = z
  .string()
  .optional()
  .default("")
  .transform((s) => (s ?? "").trim())
  .transform((s) => (s === "" ? null : s))
  .superRefine((s, ctx) => {
    if (s === null) return;
    if (!/^\d+$/.test(s)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tiempo de entrega: solo números enteros (días).",
      });
      return;
    }
    const n = Number.parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tiempo de entrega: entre 0 y 999 días.",
      });
    }
  })
  .transform((s) => (s === null ? null : Number.parseInt(s, 10)));

export const createProveedorSchema = z
  .object({
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio.")
      .transform((s) => s.trim())
      .refine((s) => s.length >= 2, "El nombre debe tener al menos 2 caracteres."),
    prefijo: prefijoProveedorOpcionalSchema,
    whatsapp: whatsappSchema,
    coeficienteTintometrico: coeficienteTintometricoSchema,
    tiempoEntregaEnDias: tiempoEntregaEnDiasSchema,
    proveedorMercaderia: proveedorMercaderiaFormSchema,
    esFabrica: esFabricaFormSchema,
    iva: ivaProveedorFormSchema,
  })
  .and(planPlazosProveedorFormSchema);
export type CreateProveedorFormData = z.infer<typeof createProveedorSchema>;

/** Misma validación que crear. Reutilizable en editar. */
export const updateProveedorSchema = createProveedorSchema;
export type UpdateProveedorFormData = z.infer<typeof updateProveedorSchema>;
