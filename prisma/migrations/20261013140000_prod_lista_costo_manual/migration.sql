-- prod_lista.costo_compra (espejo DUX) → costo_manual: solo vale para ítems sin vínculos con proveedores.
-- Con vínculos, el costo es proveedores_prod_lista.px_compra_final_sin_iva vía costo_compra_cod_ext.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prod_lista' AND column_name = 'costo_compra'
  ) THEN
    ALTER TABLE "prod_lista" RENAME COLUMN "costo_compra" TO "costo_manual";
  END IF;
END $$;

ALTER TABLE "prod_lista" ALTER COLUMN "costo_manual" DROP NOT NULL;
ALTER TABLE "prod_lista" ALTER COLUMN "costo_manual" DROP DEFAULT;

UPDATE "prod_lista" t
SET "costo_manual" = NULL
WHERE "costo_manual" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "proveedores_prod_lista" p WHERE p."cod_tienda" = t."cod_tienda"
  );

-- Un único vínculo habilitado sin CX elegido → se toma por defecto.
UPDATE "prod_lista" t
SET "costo_compra_cod_ext" = u."cod_ext"
FROM (
  SELECT p."cod_tienda", MIN(p."cod_ext") AS "cod_ext"
  FROM "proveedores_prod_lista" p
  WHERE p."cod_tienda" IS NOT NULL AND p."habilitado" = true
  GROUP BY p."cod_tienda"
  HAVING COUNT(*) = 1
) u
WHERE t."cod_tienda" = u."cod_tienda"
  AND t."costo_compra_cod_ext" IS NULL;
