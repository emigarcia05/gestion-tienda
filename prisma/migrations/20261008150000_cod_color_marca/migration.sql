-- Marca del COD. COLOR tintométrico (independiente de la marca del producto / base).
ALTER TABLE "vtas_comprobantes_items" ADD COLUMN "cod_color_id_marca" TEXT;
ALTER TABLE "prod_ped_historial_merc" ADD COLUMN "cod_color_id_marca" TEXT;
ALTER TABLE "prod_ped_merc" ADD COLUMN "tintometrico_cod_color_id_marca" TEXT;

ALTER TABLE "vtas_comprobantes_items"
  ADD CONSTRAINT "vtas_comprobantes_items_cod_color_id_marca_fkey"
  FOREIGN KEY ("cod_color_id_marca") REFERENCES "prod_marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prod_ped_historial_merc"
  ADD CONSTRAINT "prod_ped_historial_merc_cod_color_id_marca_fkey"
  FOREIGN KEY ("cod_color_id_marca") REFERENCES "prod_marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prod_ped_merc"
  ADD CONSTRAINT "prod_ped_merc_tintometrico_cod_color_id_marca_fkey"
  FOREIGN KEY ("tintometrico_cod_color_id_marca") REFERENCES "prod_marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
