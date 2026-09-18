-- Marcas Cx. Fin. Cobros: cx_fin_cobro_marcas → cobros_terminal_marca

ALTER TABLE "cx_fin_cobro_marcas" RENAME TO "cobros_terminal_marca";

ALTER TABLE "cobros_terminal_marca"
  RENAME CONSTRAINT "cx_fin_cobro_marcas_pkey" TO "cobros_terminal_marca_pkey";

ALTER INDEX "cx_fin_cobro_marcas_nombre_key"
  RENAME TO "cobros_terminal_marca_nombre_key";

ALTER INDEX "cx_fin_cobro_marcas_orden_idx"
  RENAME TO "cobros_terminal_marca_orden_idx";
