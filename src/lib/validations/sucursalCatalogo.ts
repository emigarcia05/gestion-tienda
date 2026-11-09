import { z } from "zod";
import { globalSucursalIdSchema } from "@/lib/validations/common";

const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ingresá una hora válida.");

function minutosHora(hora: string): number {
  const [horas, minutos] = hora.split(":");
  return Number(horas) * 60 + Number(minutos);
}

function rangoPosterior(
  desde: string,
  hasta: string,
  ctx: z.RefinementCtx,
  pathHasta: string
) {
  if (!horaSchema.safeParse(desde).success || !horaSchema.safeParse(hasta).success) return;
  if (minutosHora(desde) >= minutosHora(hasta)) {
    ctx.addIssue({
      code: "custom",
      path: [pathHasta],
      message: "El hasta tiene que ser posterior al desde.",
    });
  }
}

const bloqueCerradoSchema = z.object({
  modo: z.literal("cerrado"),
});

const bloqueCorridoSchema = z
  .object({
    modo: z.literal("corrido"),
    desde: horaSchema,
    hasta: horaSchema,
  })
  .superRefine((data, ctx) => {
    rangoPosterior(data.desde, data.hasta, ctx, "hasta");
  });

const bloqueCortadoSchema = z
  .object({
    modo: z.literal("cortado"),
    mananaDesde: horaSchema,
    mananaHasta: horaSchema,
    tardeDesde: horaSchema,
    tardeHasta: horaSchema,
  })
  .superRefine((data, ctx) => {
    rangoPosterior(data.mananaDesde, data.mananaHasta, ctx, "mananaHasta");
    rangoPosterior(data.tardeDesde, data.tardeHasta, ctx, "tardeHasta");
    if (
      !horaSchema.safeParse(data.mananaHasta).success ||
      !horaSchema.safeParse(data.tardeDesde).success
    ) {
      return;
    }
    if (minutosHora(data.mananaHasta) > minutosHora(data.tardeDesde)) {
      ctx.addIssue({
        code: "custom",
        path: ["tardeDesde"],
        message: "La tarde tiene que empezar cuando termina la mañana, o después.",
      });
    }
  });

export const horarioBloqueSchema = z.discriminatedUnion("modo", [
  bloqueCerradoSchema,
  bloqueCorridoSchema,
  bloqueCortadoSchema,
]);

/** Lun a Vie, sábado y domingo. Cada uno: cerrado, corrido o cortado. */
export const horarioSucursalSchema = z.object({
  lunVie: horarioBloqueSchema,
  sabado: horarioBloqueSchema,
  domingo: horarioBloqueSchema,
});

export type HorarioBloque = z.infer<typeof horarioBloqueSchema>;
export type HorarioSucursal = z.infer<typeof horarioSucursalSchema>;

export const actualizarSucursalCatalogoSchema = z.object({
  id: globalSucursalIdSchema,
  nombre: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre.")
    .max(120, "El nombre es demasiado largo."),
  direccion: z
    .string()
    .trim()
    .max(300, "La dirección es demasiado larga.")
    .default(""),
  telefono: z.string().trim().max(40, "El teléfono es demasiado largo.").default(""),
  horario: horarioSucursalSchema,
});

export type ActualizarSucursalCatalogoInput = z.infer<
  typeof actualizarSucursalCatalogoSchema
>;

export const eliminarSucursalCatalogoSchema = z.object({
  id: globalSucursalIdSchema,
});

export type EliminarSucursalCatalogoInput = z.infer<
  typeof eliminarSucursalCatalogoSchema
>;
