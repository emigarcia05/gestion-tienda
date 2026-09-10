import { z } from "zod";
import { prismaCuidSchema } from "@/lib/validations/common";
import { titularCajaTesoreriaSchema } from "@/lib/cajasTesoreriaTitulares";

export const tenedorChequeTesoreriaSchema = titularCajaTesoreriaSchema;

const isoYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD).")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Fecha de calendario inválida.");

export const montoChequeTesoreriaSchema = z
  .number()
  .int("El monto debe ser entero.")
  .min(0, "El monto no puede ser negativo.")
  .max(2_000_000_000, "Monto demasiado grande.");

export const tipoChequeTesoreriaSchema = z.enum(["FISICO", "ECHEQUE"]);

export const crearFinTesoreriaChequeSchema = z.object({
  cajaId: prismaCuidSchema,
  tipo: tipoChequeTesoreriaSchema,
  tenedor: tenedorChequeTesoreriaSchema,
  emisor: z
    .string()
    .trim()
    .min(1, "Indique el emisor.")
    .max(500, "Emisor demasiado largo."),
  monto: montoChequeTesoreriaSchema,
  fechaAcreditacion: isoYmdSchema,
  fechaRecibido: isoYmdSchema,
});

/** Filtro de custodia en detalle de cheques: en tienda vs. transferidos a cuenta o entregados a proveedor. */
export const finTesoreriaChequesTenenciaFiltroSchema = z.enum(["actuales", "transferidos"]);

export type FinTesoreriaChequesTenenciaFiltro = z.infer<typeof finTesoreriaChequesTenenciaFiltroSchema>;

export const listarFinTesoreriaChequesPorCajaSchema = z.object({
  cajaId: prismaCuidSchema,
  tenenciaFiltro: finTesoreriaChequesTenenciaFiltroSchema.default("actuales"),
});

export const actualizarFinTesoreriaChequeSchema = z.object({
  id: prismaCuidSchema,
  tipo: tipoChequeTesoreriaSchema,
  tenedor: tenedorChequeTesoreriaSchema,
  emisor: z
    .string()
    .trim()
    .min(1, "Indique el emisor.")
    .max(500, "Emisor demasiado largo."),
  monto: montoChequeTesoreriaSchema,
  fechaAcreditacion: isoYmdSchema,
  fechaRecibido: isoYmdSchema,
});

export const eliminarFinTesoreriaChequeSchema = z.object({
  id: prismaCuidSchema,
});

export const transferirFinTesoreriaChequeSchema = z.object({
  chequeId: prismaCuidSchema,
  cajaDestinoId: prismaCuidSchema,
});

/** Marca custodia PROVEEDOR y registra `fecha_transferencia` (día de negocio; FK a proveedor de mercadería). */
export const marcarEntregaProveedorChequeSchema = z.object({
  chequeId: prismaCuidSchema,
  proveedorId: prismaCuidSchema,
  fechaTransferencia: isoYmdSchema,
});

export type CrearFinTesoreriaChequeInput = z.infer<typeof crearFinTesoreriaChequeSchema>;
export type ActualizarFinTesoreriaChequeInput = z.infer<
  typeof actualizarFinTesoreriaChequeSchema
>;
export type TransferirFinTesoreriaChequeInput = z.infer<typeof transferirFinTesoreriaChequeSchema>;
export type MarcarEntregaProveedorChequeInput = z.infer<typeof marcarEntregaProveedorChequeSchema>;
