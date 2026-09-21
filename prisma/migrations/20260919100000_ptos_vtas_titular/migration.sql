-- ptos_vtas.nombre_titular → titular (FK a tesoreria_titulares.nombre)

INSERT INTO "tesoreria_titulares" ("id", "nombre", "created_at", "updated_at")
SELECT gen_random_uuid()::text, n.nombre, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT upper(trim("nombre_titular")) AS nombre
  FROM "ptos_vtas"
  WHERE "nombre_titular" IS NOT NULL AND trim("nombre_titular") <> ''
) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM "tesoreria_titulares" AS t WHERE t."nombre" = n.nombre
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ptos_vtas"
    WHERE "nombre_titular" IS NULL OR trim("nombre_titular") = ''
  ) THEN
    RAISE EXCEPTION 'ptos_vtas.nombre_titular vacío: no se puede vincular a tesoreria_titulares';
  END IF;
END $$;

UPDATE "ptos_vtas" AS p
SET "nombre_titular" = t."nombre"
FROM "tesoreria_titulares" AS t
WHERE upper(trim(p."nombre_titular")) = t."nombre";

ALTER TABLE "ptos_vtas" RENAME COLUMN "nombre_titular" TO "titular";

CREATE INDEX "ptos_vtas_titular_idx" ON "ptos_vtas"("titular");

ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_titular_fkey"
  FOREIGN KEY ("titular") REFERENCES "tesoreria_titulares"("nombre")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
