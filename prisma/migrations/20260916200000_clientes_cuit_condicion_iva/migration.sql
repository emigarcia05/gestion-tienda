-- clientes: CUIT opcional + condición IVA (FK a condicion_iva_cod_arca.codigo).

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "cuit" VARCHAR(11),
  ADD COLUMN IF NOT EXISTS "condicion_iva" INTEGER;

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_cuit_check";
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cuit_check"
  CHECK ("cuit" IS NULL OR "cuit" ~ '^[0-9]{11}$');

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_condicion_iva_fkey";
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_condicion_iva_fkey"
  FOREIGN KEY ("condicion_iva") REFERENCES "condicion_iva_cod_arca"("codigo")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "clientes_condicion_iva_idx"
  ON "clientes" ("condicion_iva");

CREATE INDEX IF NOT EXISTS "clientes_cuit_idx"
  ON "clientes" ("cuit");
