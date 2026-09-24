-- Rename comprobantes_vtas.tipo_local → tipo_comprobante (CHECK + constraint name).

ALTER TABLE "comprobantes_vtas" RENAME COLUMN "tipo_local" TO "tipo_comprobante";

ALTER TABLE "comprobantes_vtas"
  RENAME CONSTRAINT "comprobantes_vtas_tipo_local_chk" TO "comprobantes_vtas_tipo_comprobante_chk";
