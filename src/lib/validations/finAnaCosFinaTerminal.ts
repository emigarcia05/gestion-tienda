import { z } from "zod";
import { prismaCuidOrUuidSchema, prismaCuidSchema } from "@/lib/validations/common";

const idDuxTerminalSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Ingresá un ID DUX numérico.")
  .max(20, "El ID DUX es demasiado largo.");

export const crearFinAnaCosFinaTerminalSchema = z.object({
  idDux: idDuxTerminalSchema,
  marcaId: prismaCuidOrUuidSchema,
  titularId: prismaCuidSchema,
});

export const editarFinAnaCosFinaTerminalSchema = z.object({
  id: prismaCuidOrUuidSchema,
  idDux: idDuxTerminalSchema,
  marcaId: prismaCuidOrUuidSchema,
  titularId: prismaCuidSchema,
});

export const eliminarFinAnaCosFinaTerminalSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearFinAnaCosFinaTerminalInput = z.infer<typeof crearFinAnaCosFinaTerminalSchema>;
export type EditarFinAnaCosFinaTerminalInput = z.infer<typeof editarFinAnaCosFinaTerminalSchema>;
export type EliminarFinAnaCosFinaTerminalInput = z.infer<typeof eliminarFinAnaCosFinaTerminalSchema>;
