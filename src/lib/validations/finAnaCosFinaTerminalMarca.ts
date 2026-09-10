import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreMarcaSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

export const crearFinAnaCosFinaTerminalMarcaSchema = z.object({
  nombre: nombreMarcaSchema,
});

export const editarFinAnaCosFinaTerminalMarcaSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreMarcaSchema,
});

export const eliminarFinAnaCosFinaTerminalMarcaSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearFinAnaCosFinaTerminalMarcaInput = z.infer<
  typeof crearFinAnaCosFinaTerminalMarcaSchema
>;
export type EditarFinAnaCosFinaTerminalMarcaInput = z.infer<
  typeof editarFinAnaCosFinaTerminalMarcaSchema
>;
export type EliminarFinAnaCosFinaTerminalMarcaInput = z.infer<
  typeof eliminarFinAnaCosFinaTerminalMarcaSchema
>;
