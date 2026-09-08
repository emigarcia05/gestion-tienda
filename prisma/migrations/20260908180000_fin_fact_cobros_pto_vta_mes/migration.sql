-- Totales mensuales de monto gravado A/C por punto de venta (Fact & Cobros).
CREATE TABLE IF NOT EXISTS "fin_fact_cobros_pto_vta_mes" (
  "id" TEXT NOT NULL,
  "nro_pto_vta" TEXT NOT NULL,
  "mes" INTEGER NOT NULL,
  "anio" INTEGER NOT NULL,
  "monto_gravado" DECIMAL(14,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fin_fact_cobros_pto_vta_mes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fin_fact_cobros_pto_vta_mes_ux"
ON "fin_fact_cobros_pto_vta_mes" ("nro_pto_vta", "mes", "anio");

CREATE INDEX IF NOT EXISTS "fin_fact_cobros_pto_vta_mes_anio_mes_idx"
ON "fin_fact_cobros_pto_vta_mes" ("anio", "mes");
