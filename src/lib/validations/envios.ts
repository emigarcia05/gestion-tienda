import { z } from "zod";
import {
  CLIENTE_TIPO_VALUES,
  ENVIOS_DEPARTAMENTO_VALUES,
  ENVIOS_FORMA_PAGADO_VALUES,
  ENVIOS_HORA_VALUES,
  capitalizarTextoEnvio,
  direccionEnvioTieneDato,
  normalizarNombreCliente,
  properTextoEnvio,
  type ClienteTipoValue,
} from "@/lib/envios";
import {
  prismaCuidSchema,
  prismaIdOptionalNullableSchema,
  globalSucursalIdSchema,
} from "@/lib/validations/common";

const textoOpcionalSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "El texto es demasiado largo.")
    .optional()
    .transform((v) => v ?? "");

const urlMapsSchema = z
  .string()
  .trim()
  .max(2048, "La URL de Maps es demasiado larga.")
  .optional()
  .transform((v) => v ?? "")
  .refine(
    (s) => s === "" || /^https?:\/\//i.test(s),
    "Ingresá una URL válida (http/https) o dejá el campo vacío."
  );

const pdfNombreSchema = z
  .string()
  .trim()
  .min(1, "Ingresá el nombre del PDF.")
  .max(200, "El nombre del PDF es demasiado largo.")
  .refine((n) => n.toLowerCase().endsWith(".pdf"), "El archivo debe ser un PDF.");

/** Base64 de PDF (tope ~5 MB de archivo). */
const pdfBase64Schema = z
  .string()
  .min(1, "El PDF está vacío.")
  .max(7_000_000, "El PDF supera el tamaño máximo (5 MB).");

export const enviosPdfComprobanteSchema = z.object({
  nombre: pdfNombreSchema,
  base64: pdfBase64Schema,
});

const clienteCampos = {
  nombreCompleto: z
    .string()
    .trim()
    .max(400, "El nombre completo es demasiado largo.")
    .transform(normalizarNombreCliente),
  cel: textoOpcionalSchema(40),
  tipo: z.enum(CLIENTE_TIPO_VALUES),
  pintorAsociadoId: prismaIdOptionalNullableSchema,
};

function refineClientePintorAsociado(
  data: {
    id?: string;
    tipo: ClienteTipoValue;
    nombreCompleto: string;
    cel: string;
    pintorAsociadoId?: string | null;
  },
  ctx: z.RefinementCtx
): void {
  if (data.tipo === "PINTOR" && data.nombreCompleto === "") {
    ctx.addIssue({
      code: "custom",
      message: "Ingresá el nombre completo.",
      path: ["nombreCompleto"],
    });
  }

  if (data.nombreCompleto === "" && data.cel.trim() === "") {
    ctx.addIssue({
      code: "custom",
      message: "Si el nombre está vacío, ingresá un CEL.",
      path: ["cel"],
    });
  }

  if (data.tipo === "PINTOR" && data.pintorAsociadoId) {
    ctx.addIssue({
      code: "custom",
      message: "Un pintor no puede tener pintor asociado.",
      path: ["pintorAsociadoId"],
    });
  }
  if (data.id && data.pintorAsociadoId && data.pintorAsociadoId === data.id) {
    ctx.addIssue({
      code: "custom",
      message: "El cliente no puede asociarse a sí mismo.",
      path: ["pintorAsociadoId"],
    });
  }
}

export const crearClienteSchema = z.object(clienteCampos).superRefine(refineClientePintorAsociado);

export const editarClienteSchema = z
  .object({
    id: prismaCuidSchema,
    ...clienteCampos,
  })
  .superRefine(refineClientePintorAsociado);

export const eliminarClienteSchema = z.object({
  id: prismaCuidSchema,
});

const textoEnvioOpcionalSchema = (max: number) =>
  textoOpcionalSchema(max).transform((v) => (v === "" ? "" : capitalizarTextoEnvio(v)));

const textoEnvioProperOpcionalSchema = (max: number) =>
  textoOpcionalSchema(max).transform((v) => (v === "" ? "" : properTextoEnvio(v)));

const departamentoOpcionalSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.enum(ENVIOS_DEPARTAMENTO_VALUES).nullable()
);

function refineDireccionAlMenosUnDato(
  data: {
    calleNombre?: string;
    numeracion?: string;
    distrito?: string;
    departamento?: string | null;
    urlMaps?: string;
    referencia?: string;
  },
  ctx: z.RefinementCtx
): void {
  if (!direccionEnvioTieneDato(data)) {
    ctx.addIssue({
      code: "custom",
      message: "Completá al menos un dato de la dirección.",
      path: ["calleNombre"],
    });
  }
}

export const crearEnviosDireccionSchema = z
  .object({
    personaId: prismaCuidSchema,
    calleNombre: textoEnvioProperOpcionalSchema(400),
    numeracion: textoEnvioOpcionalSchema(40),
    distrito: textoEnvioProperOpcionalSchema(200),
    departamento: departamentoOpcionalSchema,
    urlMaps: urlMapsSchema,
    referencia: textoEnvioOpcionalSchema(2000),
  })
  .superRefine(refineDireccionAlMenosUnDato);

export const editarEnviosDireccionSchema = crearEnviosDireccionSchema.extend({
  id: prismaCuidSchema,
});

export const eliminarEnviosDireccionSchema = z.object({
  id: prismaCuidSchema,
});

const envioPersonasCampos = {
  clienteFinalId: prismaIdOptionalNullableSchema,
  pintorId: prismaIdOptionalNullableSchema,
};

function refinePersonasEnvio(
  data: { clienteFinalId?: string | null; pintorId?: string | null },
  ctx: z.RefinementCtx
): void {
  if (!data.clienteFinalId && !data.pintorId) {
    ctx.addIssue({
      code: "custom",
      message: "Asociá al menos un cliente final o un pintor.",
      path: ["clienteFinalId"],
    });
  }
  if (data.clienteFinalId && data.pintorId && data.clienteFinalId === data.pintorId) {
    ctx.addIssue({
      code: "custom",
      message: "El cliente final y el pintor deben ser clientes distintos.",
      path: ["pintorId"],
    });
  }
}

const isoYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use YYYY-MM-DD).")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Fecha de calendario inválida.");

const horaEnvioSchema = z.enum(ENVIOS_HORA_VALUES, "Seleccioná un horario válido.");

function refineHorarioEnvio(
  data: { horaDesde: string; horaHasta: string },
  ctx: z.RefinementCtx
): void {
  if (data.horaDesde >= data.horaHasta) {
    ctx.addIssue({
      code: "custom",
      message: "La hora hasta debe ser posterior a la hora desde.",
      path: ["horaHasta"],
    });
  }
}

const envioFinalCamposBase = {
  ...envioPersonasCampos,
  sucursalId: globalSucursalIdSchema,
  direccionId: prismaCuidSchema,
  fechaEnvioIso: isoYmdSchema,
  horaDesde: horaEnvioSchema,
  horaHasta: horaEnvioSchema,
  observacionEnvio: textoOpcionalSchema(5000),
  pagado: z.boolean(),
  formaPagado: z.enum(ENVIOS_FORMA_PAGADO_VALUES),
};

export const crearEnviosFinalSchema = z
  .object({
    ...envioFinalCamposBase,
    pdfComprobante: enviosPdfComprobanteSchema.optional(),
  })
  .superRefine((data, ctx) => {
    refinePersonasEnvio(data, ctx);
    refineHorarioEnvio(data, ctx);
  });

export const editarEnviosFinalSchema = z
  .object({
    id: prismaCuidSchema,
    ...envioFinalCamposBase,
    pdfComprobante: enviosPdfComprobanteSchema.optional(),
    quitarPdf: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    refinePersonasEnvio(data, ctx);
    refineHorarioEnvio(data, ctx);
    if (data.pdfComprobante && data.quitarPdf) {
      ctx.addIssue({
        code: "custom",
        message: "No se puede adjuntar y quitar el PDF a la vez.",
        path: ["pdfComprobante"],
      });
    }
  });

export const eliminarEnviosFinalSchema = z.object({
  id: prismaCuidSchema,
});

export const enviosFinalEntregadoSchema = z.object({
  id: prismaCuidSchema,
  entregado: z.boolean(),
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type EditarClienteInput = z.infer<typeof editarClienteSchema>;
export type CrearEnviosDireccionInput = z.infer<typeof crearEnviosDireccionSchema>;
export type EditarEnviosDireccionInput = z.infer<typeof editarEnviosDireccionSchema>;
export type CrearEnviosFinalInput = z.infer<typeof crearEnviosFinalSchema>;
export type EditarEnviosFinalInput = z.infer<typeof editarEnviosFinalSchema>;
