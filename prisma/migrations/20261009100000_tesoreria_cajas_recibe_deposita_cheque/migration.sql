-- Cada caja define si recibe cheques (viven ahí como cheque) y/o si acepta depósitos de cheques.
ALTER TABLE "tesoreria_cajas" ADD COLUMN "recibe_cheque" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tesoreria_cajas" ADD COLUMN "deposita_cheque" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tesoreria_cajas" SET "recibe_cheque" = true WHERE "tipo_caja" = 'CHEQUE';

-- El cheque suma a su caja desde la fecha de acreditación.
ALTER TABLE "tesoreria_cheques" RENAME COLUMN "fecha_pago" TO "fecha_acreditacion";
ALTER INDEX "tesoreria_cheques_estado_fecha_pago_idx" RENAME TO "tesoreria_cheques_estado_fecha_acred_idx";
