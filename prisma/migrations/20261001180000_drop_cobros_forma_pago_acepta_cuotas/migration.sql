-- Toda forma de pago acepta cuotas. El vínculo vive en cobros_cuotas (pago_id + entidad_id).
ALTER TABLE "cobros_forma_pago"
  DROP COLUMN IF EXISTS "acepta_cuotas";
