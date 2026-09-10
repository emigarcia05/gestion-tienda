-- Persistencia de ítems de cobros para análisis y estadísticas.
CREATE TABLE IF NOT EXISTS "fin_fact_cobros_items" (
  "id" TEXT NOT NULL,
  "pto_vta_id" TEXT NOT NULL,
  "id_sucursal_dux" INTEGER NOT NULL,
  "id_remito_venta" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "anio" INTEGER NOT NULL,
  "fecha_ymd" CHAR(10) NOT NULL,
  "letra" CHAR(1) NOT NULL,
  "estado_facturacion" TEXT NOT NULL,
  "nro_factura_string" TEXT NOT NULL,
  "monto_gravado" DECIMAL(14,4) NOT NULL,
  "anulado" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fin_fact_cobros_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fin_fact_cobros_items_pto_vta_id_fkey"
    FOREIGN KEY ("pto_vta_id") REFERENCES "global_pto_vtas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fin_fact_cobros_items_letra_chk"
    CHECK ("letra" ~ '^[A-Z]$'),
  CONSTRAINT "fin_fact_cobros_items_fecha_ymd_chk"
    CHECK ("fecha_ymd" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "fin_fact_cobros_items_ux"
ON "fin_fact_cobros_items" ("pto_vta_id", "id_sucursal_dux", "id_remito_venta", "letra");

CREATE INDEX IF NOT EXISTS "fin_fact_cobros_items_anio_mes_idx"
ON "fin_fact_cobros_items" ("anio", "mes");

CREATE INDEX IF NOT EXISTS "fin_fact_cobros_items_pto_vta_idx"
ON "fin_fact_cobros_items" ("pto_vta_id");

CREATE INDEX IF NOT EXISTS "fin_fact_cobros_items_sucursal_dux_idx"
ON "fin_fact_cobros_items" ("id_sucursal_dux");
