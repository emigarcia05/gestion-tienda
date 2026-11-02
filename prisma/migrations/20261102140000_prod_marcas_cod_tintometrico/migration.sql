-- La marca acepta COD. COLOR tintométrico solo si el flag está en true.
-- Filas ya cargadas: con formato → true; sin formato (NULL o blanco) → false.
ALTER TABLE "prod_marcas" ADD COLUMN "cod_tintometrico" BOOLEAN NOT NULL DEFAULT false;

UPDATE "prod_marcas"
SET "cod_tintometrico" = true
WHERE "formato_cod_tintometrico" IS NOT NULL
  AND btrim("formato_cod_tintometrico") <> '';
