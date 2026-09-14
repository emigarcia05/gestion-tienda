-- Rename tipo_local: factura (no ARCA) → comprobante; factura_fiscal → factura (WSFEv1).
-- Orden: primero el no fiscal, para no pisar el fiscal al reciclar el literal `factura`.

ALTER TABLE "fact_comprobantes"
  DROP CONSTRAINT IF EXISTS "fact_comprobantes_tipo_local_chk";

UPDATE "fact_comprobantes"
SET "tipo_local" = 'comprobante'
WHERE "tipo_local" = 'factura';

UPDATE "fact_comprobantes"
SET "tipo_local" = 'factura'
WHERE "tipo_local" = 'factura_fiscal';

ALTER TABLE "fact_comprobantes"
  ADD CONSTRAINT "fact_comprobantes_tipo_local_chk"
  CHECK ("tipo_local" IN ('presupuesto', 'comprobante', 'factura', 'nota_credito'));

-- Serie interna (presupuesto / comprobante): independiente de ARCA y de la otra serie local.
CREATE UNIQUE INDEX "fact_comprobantes_local_nro_key"
  ON "fact_comprobantes" ("pto_vta_id", "tipo_local", "cbte_nro")
  WHERE "cbte_tipo" IS NULL AND "cbte_nro" IS NOT NULL;
