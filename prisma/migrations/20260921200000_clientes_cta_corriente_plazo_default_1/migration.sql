-- clientes.cta_corriente_plazo: todas las filas = 1; default 1 en altas
UPDATE "clientes"
SET "cta_corriente_plazo" = 1;

ALTER TABLE "clientes"
ALTER COLUMN "cta_corriente_plazo" SET DEFAULT 1;
