-- Rename fact_comprobantes* → comprobantes_vtas*
-- Alinea tipo_local a factura_no_fiscal / factura_fiscal / nota_credito_* / presupuesto
-- Agrega efecto_stock + stock_aplicado (reglas de movimiento de stock).

-- 1) Tablas
ALTER TABLE "fact_comprobantes" RENAME TO "comprobantes_vtas";
ALTER TABLE "fact_comprobante_lineas" RENAME TO "comprobantes_vtas_items";
ALTER TABLE "fact_comprobante_intentos" RENAME TO "comprobantes_vtas_historial_arca";

-- 2) PK / constraints (cabecera)
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_pkey" TO "comprobantes_vtas_pkey";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_pto_vta_id_fkey" TO "comprobantes_vtas_pto_vta_id_fkey";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_receptor_iva_fkey" TO "comprobantes_vtas_receptor_iva_fkey";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_cbte_asoc_id_fkey" TO "comprobantes_vtas_cbte_asoc_id_fkey";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_estado_chk" TO "comprobantes_vtas_estado_chk";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_ambiente_chk" TO "comprobantes_vtas_ambiente_chk";
ALTER TABLE "comprobantes_vtas" RENAME CONSTRAINT "fact_comprobantes_resultado_chk" TO "comprobantes_vtas_resultado_chk";

ALTER TABLE "comprobantes_vtas_items" RENAME CONSTRAINT "fact_comprobante_lineas_pkey" TO "comprobantes_vtas_items_pkey";
ALTER TABLE "comprobantes_vtas_items" RENAME CONSTRAINT "fact_comprobante_lineas_comprobante_id_fkey" TO "comprobantes_vtas_items_comprobante_id_fkey";

ALTER TABLE "comprobantes_vtas_historial_arca" RENAME CONSTRAINT "fact_comprobante_intentos_pkey" TO "comprobantes_vtas_historial_arca_pkey";
ALTER TABLE "comprobantes_vtas_historial_arca" RENAME CONSTRAINT "fact_comprobante_intentos_comprobante_id_fkey" TO "comprobantes_vtas_historial_arca_comprobante_id_fkey";

-- 3) Índices
ALTER INDEX IF EXISTS "fact_comprobantes_tipo_fecha_idx" RENAME TO "comprobantes_vtas_tipo_fecha_idx";
ALTER INDEX IF EXISTS "fact_comprobantes_pto_vta_idx" RENAME TO "comprobantes_vtas_pto_vta_idx";
ALTER INDEX IF EXISTS "fact_comprobantes_cae_idx" RENAME TO "comprobantes_vtas_cae_idx";
ALTER INDEX IF EXISTS "fact_comprobantes_receptor_iva_idx" RENAME TO "comprobantes_vtas_receptor_iva_idx";
ALTER INDEX IF EXISTS "fact_comprobante_lineas_comp_idx" RENAME TO "comprobantes_vtas_items_comp_idx";
ALTER INDEX IF EXISTS "fact_comprobante_intentos_comp_idx" RENAME TO "comprobantes_vtas_historial_arca_comp_idx";
ALTER INDEX IF EXISTS "fact_comprobantes_fiscal_nro_key" RENAME TO "comprobantes_vtas_fiscal_nro_key";
ALTER INDEX IF EXISTS "fact_comprobantes_local_nro_key" RENAME TO "comprobantes_vtas_local_nro_key";

-- 4) tipo_local: valores acordados
ALTER TABLE "comprobantes_vtas" DROP CONSTRAINT IF EXISTS "fact_comprobantes_tipo_local_chk";
ALTER TABLE "comprobantes_vtas" DROP CONSTRAINT IF EXISTS "comprobantes_vtas_tipo_local_chk";

UPDATE "comprobantes_vtas" SET "tipo_local" = 'factura_no_fiscal' WHERE "tipo_local" = 'comprobante';
UPDATE "comprobantes_vtas" SET "tipo_local" = 'factura_fiscal' WHERE "tipo_local" = 'factura';
UPDATE "comprobantes_vtas" SET "tipo_local" = 'nota_credito_fiscal' WHERE "tipo_local" = 'nota_credito';
-- presupuesto sin cambio

ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_tipo_local_chk"
  CHECK (
    "tipo_local" IN (
      'presupuesto',
      'factura_no_fiscal',
      'factura_fiscal',
      'nota_credito_no_fiscal',
      'nota_credito_fiscal'
    )
  );

-- 5) Columnas stock (reglas de negocio; el movimiento aún no se implementa aquí)
ALTER TABLE "comprobantes_vtas"
  ADD COLUMN IF NOT EXISTS "efecto_stock" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "stock_aplicado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "comprobantes_vtas"
SET "efecto_stock" = CASE "tipo_local"
  WHEN 'factura_no_fiscal' THEN 'salida'
  WHEN 'factura_fiscal' THEN 'salida'
  WHEN 'nota_credito_no_fiscal' THEN 'ingreso'
  WHEN 'nota_credito_fiscal' THEN 'ninguno'
  WHEN 'presupuesto' THEN 'ninguno'
  ELSE 'ninguno'
END
WHERE "efecto_stock" IS NULL;

ALTER TABLE "comprobantes_vtas"
  ALTER COLUMN "efecto_stock" SET NOT NULL;

ALTER TABLE "comprobantes_vtas"
  DROP CONSTRAINT IF EXISTS "comprobantes_vtas_efecto_stock_chk";
ALTER TABLE "comprobantes_vtas"
  ADD CONSTRAINT "comprobantes_vtas_efecto_stock_chk"
  CHECK ("efecto_stock" IN ('salida', 'ingreso', 'ninguno'));

CREATE INDEX IF NOT EXISTS "comprobantes_vtas_efecto_stock_idx"
  ON "comprobantes_vtas" ("efecto_stock", "stock_aplicado");
