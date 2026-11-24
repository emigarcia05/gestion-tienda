-- La familia es el código que asocia los SKU. Se deja el nombre `cod_familia`.
-- El agrupado por nombre (`prod_productos`) no se usa.

ALTER TABLE "prod_lista" DROP CONSTRAINT IF EXISTS "prod_lista_id_producto_fkey";

DROP INDEX IF EXISTS "prod_lista_id_producto_idx";

ALTER TABLE "prod_lista" DROP COLUMN IF EXISTS "id_producto";

ALTER TABLE "prod_lista" DROP COLUMN IF EXISTS "producto_manual";

DROP TABLE IF EXISTS "prod_productos";

ALTER TABLE "prod_lista" RENAME COLUMN "cod_flia_item" TO "cod_familia";

ALTER INDEX "prod_lista_cod_flia_item_idx" RENAME TO "prod_lista_cod_familia_idx";
