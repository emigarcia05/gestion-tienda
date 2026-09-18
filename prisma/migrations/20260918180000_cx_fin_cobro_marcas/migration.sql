-- Drop catálogo de terminales DUX.
DROP TABLE IF EXISTS "fin_ana_cos_fina_terminales";

-- Marcas: fin_ana_cos_fina_terminales_marcas → cx_fin_cobro_marcas
ALTER TABLE "fin_ana_cos_fina_terminales_marcas" RENAME TO "cx_fin_cobro_marcas";

ALTER TABLE "cx_fin_cobro_marcas"
  RENAME CONSTRAINT "fin_ana_cos_fina_terminales_marcas_pkey" TO "cx_fin_cobro_marcas_pkey";

ALTER INDEX "fin_ana_cos_fina_terminales_marcas_nombre_key"
  RENAME TO "cx_fin_cobro_marcas_nombre_key";

ALTER INDEX "fin_ana_cos_fina_terminales_marcas_orden_idx"
  RENAME TO "cx_fin_cobro_marcas_orden_idx";
