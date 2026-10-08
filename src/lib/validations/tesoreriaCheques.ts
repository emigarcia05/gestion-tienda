import { z } from "zod";
import { prismaIdSchema } from "@/lib/validations/common";

const chequeIdsSchema = z
  .array(prismaIdSchema)
  .min(1, "Seleccioná al menos un cheque.")
  .max(200, "Demasiados cheques en una sola operación.");

export const depositarChequesSchema = z.object({
  chequeIds: chequeIdsSchema,
  cajaDestinoId: prismaIdSchema,
  observacion: z.string().max(2000).default(""),
});

export type DepositarChequesInput = z.infer<typeof depositarChequesSchema>;

export const pagarProveedorConChequesSchema = z.object({
  chequeIds: chequeIdsSchema,
  proveedorId: prismaIdSchema,
  observacion: z.string().max(2000).default(""),
});

export type PagarProveedorConChequesInput = z.infer<typeof pagarProveedorConChequesSchema>;
