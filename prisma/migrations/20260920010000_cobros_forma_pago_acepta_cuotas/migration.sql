-- cobros_forma_pago: asociado_terminal → acepta_cuotas; drop asociado_banco.
-- fin_ana_cos_fina: FK cuota + variantes pago × entidad × cuota.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cobros_forma_pago'
      AND column_name = 'asociado_terminal'
  ) THEN
    ALTER TABLE "cobros_forma_pago" RENAME COLUMN "asociado_terminal" TO "acepta_cuotas";
  END IF;
END $$;

ALTER TABLE "cobros_forma_pago" DROP COLUMN IF EXISTS "asociado_banco";

DROP INDEX IF EXISTS "fin_ana_cos_fina_terminal_pago_ux";

ALTER TABLE "fin_ana_cos_fina" ADD COLUMN IF NOT EXISTS "cuota_id" TEXT;

-- Variantes: copiar cada fila de un pago que acepta cuotas a todas las cuotas (excepto la primera, que se asigna a la fila original).
INSERT INTO "fin_ana_cos_fina" (
  "id",
  "habilitado",
  "imp_cheque",
  "terminal_id",
  "pago_id",
  "cuota_id",
  "dias_acreditacion",
  "arancel",
  "costo_financiero",
  "created_at",
  "updated_at"
)
SELECT
  'c' || substr(md5(f."id" || ':' || c."id"), 1, 24),
  f."habilitado",
  f."imp_cheque",
  f."terminal_id",
  f."pago_id",
  c."id",
  f."dias_acreditacion",
  f."arancel",
  f."costo_financiero",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "fin_ana_cos_fina" f
INNER JOIN "cobros_forma_pago" p ON p."id" = f."pago_id" AND p."acepta_cuotas" = true
CROSS JOIN "cobros_cuotas" c
WHERE f."cuota_id" IS NULL
  AND c."id" <> (
    SELECT c0."id"
    FROM "cobros_cuotas" c0
    ORDER BY c0."orden" ASC, c0."cantidad" ASC
    LIMIT 1
  );

UPDATE "fin_ana_cos_fina" f
SET "cuota_id" = (
  SELECT c0."id"
  FROM "cobros_cuotas" c0
  ORDER BY c0."orden" ASC, c0."cantidad" ASC
  LIMIT 1
)
WHERE f."cuota_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "cobros_forma_pago" p
    WHERE p."id" = f."pago_id" AND p."acepta_cuotas" = true
  )
  AND EXISTS (SELECT 1 FROM "cobros_cuotas");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_ana_cos_fina_cuota_id_fkey'
  ) THEN
    ALTER TABLE "fin_ana_cos_fina"
      ADD CONSTRAINT "fin_ana_cos_fina_cuota_id_fkey"
      FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "fin_ana_cos_fina_cuota_idx"
  ON "fin_ana_cos_fina" ("cuota_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fin_ana_cos_fina_terminal_pago_cuota_ux"
  ON "fin_ana_cos_fina" ("terminal_id", "pago_id", "cuota_id")
  WHERE "cuota_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "fin_ana_cos_fina_terminal_pago_sin_cuota_ux"
  ON "fin_ana_cos_fina" ("terminal_id", "pago_id")
  WHERE "cuota_id" IS NULL;
