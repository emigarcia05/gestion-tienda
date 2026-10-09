-- ES CHEQUE pasa de la forma de pago (global) a cada fila de Cobros & Cajas (por sucursal).

ALTER TABLE "cobros_vinc_cajas" ADD COLUMN "es_cheque" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cobros_vinc_cajas" AS v
SET "es_cheque" = p."es_cheque"
FROM "cobros_forma_pago" AS p
WHERE v."pago_id" = p."id"
  AND p."es_cheque" = true;

ALTER TABLE "cobros_forma_pago" DROP COLUMN "es_cheque";
