-- Totales Fact & Cobros por punto de venta y letra de comprobante.
-- Los montos mezclados A/C no se pueden partir: se vacía el periodo y se recompone al sincronizar.

DELETE FROM "fin_fact_cobros_pto_vta_mes";

DROP INDEX IF EXISTS "fin_fact_cobros_pto_vta_mes_ux";

ALTER TABLE "fin_fact_cobros_pto_vta_mes"
  ADD COLUMN "letra" CHAR(1) NOT NULL;

ALTER TABLE "fin_fact_cobros_pto_vta_mes"
  ADD CONSTRAINT "fin_fact_cobros_pto_vta_mes_letra_chk"
  CHECK ("letra" ~ '^[A-Z]$');

CREATE UNIQUE INDEX "fin_fact_cobros_pto_vta_mes_ux"
ON "fin_fact_cobros_pto_vta_mes" ("pto_vta_id", "mes", "anio", "letra");
