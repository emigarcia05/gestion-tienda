-- Formato del código de color tintométrico por marca (máscara: L letra, N número, "…" fijo).
CREATE TABLE IF NOT EXISTS "tintometrico_marcas" (
  "id" TEXT NOT NULL,
  "id_marca" TEXT NOT NULL,
  "formato_cod" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tintometrico_marcas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tintometrico_marcas_marca_formato_key"
  ON "tintometrico_marcas" ("id_marca", "formato_cod");
CREATE INDEX IF NOT EXISTS "tintometrico_marcas_id_marca_idx"
  ON "tintometrico_marcas" ("id_marca");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tintometrico_marcas_id_marca_fkey'
  ) THEN
    ALTER TABLE "tintometrico_marcas"
      ADD CONSTRAINT "tintometrico_marcas_id_marca_fkey"
      FOREIGN KEY ("id_marca") REFERENCES "prod_marcas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
