-- Retira el flag legado "acepta_cuotas".
-- La disponibilidad de cuotas se resuelve por combinación forma de pago + entidad.
ALTER TABLE "cobros_forma_pago"
DROP COLUMN IF EXISTS "acepta_cuotas";
