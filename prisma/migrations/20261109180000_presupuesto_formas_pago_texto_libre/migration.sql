-- Las formas de pago del presupuesto dejan de vincularse a cobros_forma_pago.
-- Cada DESC. tiene renglones de texto libre.

CREATE TABLE "presupuesto_formas_pago_texto_linea" (
  "id" TEXT NOT NULL,
  "texto_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "texto" VARCHAR(80) NOT NULL,
  CONSTRAINT "presupuesto_formas_pago_texto_linea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presupuesto_formas_pago_texto_linea_texto_orden_key"
  ON "presupuesto_formas_pago_texto_linea"("texto_id", "orden");

ALTER TABLE "presupuesto_formas_pago_texto_linea"
  ADD CONSTRAINT "presupuesto_formas_pago_texto_linea_texto_id_fkey"
  FOREIGN KEY ("texto_id") REFERENCES "presupuesto_formas_pago_texto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF to_regclass('public.presupuesto_formas_pago_texto_forma') IS NOT NULL THEN
    INSERT INTO "presupuesto_formas_pago_texto_linea" ("id", "texto_id", "orden", "texto")
    SELECT gen_random_uuid()::text, f."texto_id", f."orden", LEFT(btrim(p."nombre"), 80)
    FROM "presupuesto_formas_pago_texto_forma" f
    JOIN "cobros_forma_pago" p ON p."id" = f."pago_id"
    WHERE btrim(p."nombre") <> '';
  END IF;
END $$;

DROP TABLE IF EXISTS "presupuesto_formas_pago_texto_cuota";
DROP TABLE IF EXISTS "presupuesto_formas_pago_texto_forma";
