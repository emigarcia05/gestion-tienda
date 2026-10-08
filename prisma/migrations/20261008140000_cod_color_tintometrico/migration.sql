-- COD. COLOR de ítems tintométricos en venta, historial de pedidos (compra) y pedido tintométrico.
ALTER TABLE "vtas_comprobantes_items" ADD COLUMN "cod_color" VARCHAR(40);
ALTER TABLE "prod_ped_historial_merc" ADD COLUMN "cod_color" VARCHAR(40);
ALTER TABLE "prod_ped_merc" ADD COLUMN "tintometrico_cod_color" VARCHAR(40);

CREATE INDEX "vtas_comprobantes_items_cod_color_idx" ON "vtas_comprobantes_items"("cod_color");
CREATE INDEX "prod_ped_historial_merc_cod_color_idx" ON "prod_ped_historial_merc"("cod_color");
