-- `ptos_vtas.condicion_iva`: VARCHAR legacy → INT FK a `pto_ventas_cod_arca.codigo`.
ALTER TABLE "ptos_vtas" DROP CONSTRAINT IF EXISTS "ptos_vtas_condicion_iva_check";

ALTER TABLE "ptos_vtas"
  ALTER COLUMN "condicion_iva" TYPE INTEGER
  USING (
    CASE
      WHEN "condicion_iva" = 'Responsable Inscripto' THEN 1
      WHEN "condicion_iva" = 'Monotributista' THEN 6
      WHEN "condicion_iva" ~ '^[0-9]+$' THEN "condicion_iva"::integer
      ELSE NULL
    END
  );

UPDATE "ptos_vtas" AS t
SET "condicion_iva" = NULL
WHERE t."condicion_iva" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "pto_ventas_cod_arca" AS a
    WHERE a."codigo" = t."condicion_iva"
  );

ALTER TABLE "ptos_vtas" DROP CONSTRAINT IF EXISTS "ptos_vtas_condicion_iva_fkey";
ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_condicion_iva_fkey"
  FOREIGN KEY ("condicion_iva") REFERENCES "pto_ventas_cod_arca"("codigo")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ptos_vtas_condicion_iva_idx"
  ON "ptos_vtas" ("condicion_iva");
