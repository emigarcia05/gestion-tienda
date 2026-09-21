-- Quitar `orden` de `cobros_forma_pago` (el orden de Margen Contribución pasa a ser alfabético por nombre).

DROP INDEX IF EXISTS "cobros_forma_pago_orden_idx";
ALTER TABLE "cobros_forma_pago" DROP COLUMN IF EXISTS "orden";
