-- Sucursal de cada caja. Titular deja de mezclar sucursales (SUC. GUAYMALLEN / COORPORATIVO).
ALTER TABLE "fin_tesoreria" ADD COLUMN "sucursal_id" TEXT;

UPDATE "fin_tesoreria" AS t
SET "sucursal_id" = s.id
FROM "global_sucursales" s
WHERE t."sucursal_id" IS NULL
  AND (
    (t.titular ILIKE '%GUAYMALL%' AND s.codigo = 'guaymallen')
    OR ((t.titular ILIKE '%MAIPU%' OR t.titular ILIKE '%MAIPÚ%') AND s.codigo = 'maipu')
    OR ((t.titular ILIKE '%CORPORAT%' OR t.titular ILIKE '%COORPORAT%') AND s.codigo = 'corporativo')
  );

UPDATE "fin_tesoreria" AS t
SET "sucursal_id" = s.id
FROM "global_personal" p
INNER JOIN "global_sucursales" s ON s.codigo = p.sucursal_por_defecto
WHERE t."sucursal_id" IS NULL
  AND upper(t.titular) = upper(p.nombre_personal)
  AND p.sucursal_por_defecto IS NOT NULL;

UPDATE "fin_tesoreria"
SET "sucursal_id" = COALESCE(
  (SELECT id FROM "global_sucursales" WHERE codigo = 'corporativo' LIMIT 1),
  (SELECT id FROM "global_sucursales" ORDER BY codigo ASC LIMIT 1)
)
WHERE "sucursal_id" IS NULL;

ALTER TABLE "fin_tesoreria" ALTER COLUMN "sucursal_id" SET NOT NULL;

ALTER TABLE "fin_tesoreria"
  ADD CONSTRAINT "fin_tesoreria_sucursal_id_fkey"
  FOREIGN KEY ("sucursal_id") REFERENCES "global_sucursales"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_tesoreria" DROP CONSTRAINT IF EXISTS "fin_tesoreria_entidad_titular_ux";
DROP INDEX IF EXISTS "fin_tesoreria_entidad_titular_ux";

CREATE UNIQUE INDEX "fin_tesoreria_entidad_titular_sucursal_ux"
  ON "fin_tesoreria"("entidad_id", "titular", "sucursal_id");

CREATE INDEX "fin_tesoreria_sucursal_id_idx" ON "fin_tesoreria"("sucursal_id");
