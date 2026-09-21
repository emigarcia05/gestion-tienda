-- clientes.tipo (enum ClienteTipo) → es_pintor BOOLEAN TRUE/FALSE

ALTER TABLE "clientes" DROP CONSTRAINT IF EXISTS "clientes_pintor_asociado_tipo_chk";

DROP INDEX IF EXISTS "clientes_tipo_idx";

ALTER TABLE "clientes" ADD COLUMN "es_pintor" BOOLEAN NOT NULL DEFAULT false;

UPDATE "clientes" SET "es_pintor" = TRUE WHERE "tipo" = 'PINTOR';

ALTER TABLE "clientes" DROP COLUMN "tipo";

DROP TYPE IF EXISTS "ClienteTipo";

ALTER TABLE "clientes"
ADD CONSTRAINT "clientes_pintor_asociado_es_pintor_chk"
CHECK (
  ("es_pintor" = TRUE AND "pintor_asociado" IS NULL)
  OR ("es_pintor" = FALSE AND ("pintor_asociado" IS NULL OR "pintor_asociado" <> "id"))
);

CREATE INDEX "clientes_es_pintor_idx" ON "clientes"("es_pintor");
