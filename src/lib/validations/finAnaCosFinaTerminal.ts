import { z } from "zod";
import { prismaCuidOrUuidSchema } from "@/lib/validations/common";

const nombreFinAnaCosFinaTerminalSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre.")
  .max(200, "El nombre es demasiado largo.");

/** `id_terminal` DUX (dígitos); vacío / omitido → null. */
const idDuxTerminalSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value): string | null => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((value) => value === null || /^\d+$/.test(value), "Ingresá un ID DUX numérico.")
  .refine((value) => value === null || value.length <= 20, "El ID DUX es demasiado largo.");

export const crearFinAnaCosFinaTerminalSchema = z.object({
  nombre: nombreFinAnaCosFinaTerminalSchema,
  idDux: idDuxTerminalSchema,
});

export const editarFinAnaCosFinaTerminalSchema = z.object({
  id: prismaCuidOrUuidSchema,
  nombre: nombreFinAnaCosFinaTerminalSchema,
  idDux: idDuxTerminalSchema,
});

export const eliminarFinAnaCosFinaTerminalSchema = z.object({
  id: prismaCuidOrUuidSchema,
});

export type CrearFinAnaCosFinaTerminalInput = z.infer<typeof crearFinAnaCosFinaTerminalSchema>;
export type EditarFinAnaCosFinaTerminalInput = z.infer<typeof editarFinAnaCosFinaTerminalSchema>;
export type EliminarFinAnaCosFinaTerminalInput = z.infer<typeof eliminarFinAnaCosFinaTerminalSchema>;
