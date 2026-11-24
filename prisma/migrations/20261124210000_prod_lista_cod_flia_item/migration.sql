-- Familia explícita: el mismo código agrupa SKU que solo cambian de
-- presentación, color o terminación. Vacío = sin familia asignada.

ALTER TABLE "prod_lista" ADD COLUMN "cod_flia_item" VARCHAR(40);

CREATE INDEX "prod_lista_cod_flia_item_idx" ON "prod_lista"("cod_flia_item");
