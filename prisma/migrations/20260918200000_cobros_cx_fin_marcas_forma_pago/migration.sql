-- Marcas: cx_fin_cobro_marcas → cobros_cx_fin_marcas
ALTER TABLE "cx_fin_cobro_marcas" RENAME TO "cobros_cx_fin_marcas";

ALTER TABLE "cobros_cx_fin_marcas"
  RENAME CONSTRAINT "cx_fin_cobro_marcas_pkey" TO "cobros_cx_fin_marcas_pkey";

ALTER INDEX "cx_fin_cobro_marcas_nombre_key"
  RENAME TO "cobros_cx_fin_marcas_nombre_key";

ALTER INDEX "cx_fin_cobro_marcas_orden_idx"
  RENAME TO "cobros_cx_fin_marcas_orden_idx";

-- Formas de pago: fin_ana_cos_fina_pagos → cobros_forma_pago
ALTER TABLE "fin_ana_cos_fina_pagos" RENAME TO "cobros_forma_pago";

ALTER TABLE "cobros_forma_pago"
  RENAME CONSTRAINT "fin_ana_cos_fina_pagos_pkey" TO "cobros_forma_pago_pkey";

ALTER INDEX "fin_ana_cos_fina_pagos_nombre_key"
  RENAME TO "cobros_forma_pago_nombre_key";

ALTER INDEX "fin_ana_cos_fina_pagos_orden_idx"
  RENAME TO "cobros_forma_pago_orden_idx";

ALTER TABLE "cobros_forma_pago"
  ADD COLUMN "asociado_terminal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "asociado_banco" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cobros_forma_pago"
SET "asociado_terminal" = true
WHERE "codigo" IN (
  'DEBITO',
  'CUOTA_1',
  'CUOTA_3',
  'CUOTA_6',
  'CUOTA_9',
  'CUOTA_12',
  'CUOTA_18'
)
OR "en_costos_financieros" = true;

UPDATE "cobros_forma_pago"
SET "asociado_banco" = true
WHERE "codigo" IN ('TRANSFERENCIA', 'TRANSF', 'BANCO', 'CHEQUE');

DROP INDEX IF EXISTS "fin_ana_cos_fina_pagos_codigo_key";

ALTER TABLE "cobros_forma_pago" DROP COLUMN "codigo";
