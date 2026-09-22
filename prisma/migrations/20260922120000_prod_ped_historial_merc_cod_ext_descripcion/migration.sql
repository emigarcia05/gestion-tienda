-- Snapshot de recepción: una fila por ítem de lista (`cod_ext`), no por `cod_tienda`.
-- Sin vínculo DUX, `cod_tienda` sigue pudiendo ser 1503 (PRODUCTO VARIO) para el POST;
-- la descripción y el `cod_ext` evitan colapsar todos los SKUs en una sola línea.

ALTER TABLE "prod_ped_historial_merc" ADD COLUMN "cod_ext" TEXT;
ALTER TABLE "prod_ped_historial_merc" ADD COLUMN "descripcion" TEXT NOT NULL DEFAULT '';

UPDATE "prod_ped_historial_merc"
SET "cod_ext" = "cod_tienda"
WHERE "cod_ext" IS NULL OR btrim("cod_ext") = '';

ALTER TABLE "prod_ped_historial_merc" ALTER COLUMN "cod_ext" SET NOT NULL;

ALTER TABLE "prod_ped_historial_merc"
  DROP CONSTRAINT IF EXISTS "prod_ped_historial_merc_pedido_historia_id_cod_tienda_key";

DROP INDEX IF EXISTS "prod_ped_historial_merc_pedido_historia_id_cod_tienda_key";

CREATE UNIQUE INDEX "prod_ped_historial_merc_pedido_historia_id_cod_ext_key"
  ON "prod_ped_historial_merc" ("pedido_historia_id", "cod_ext");
