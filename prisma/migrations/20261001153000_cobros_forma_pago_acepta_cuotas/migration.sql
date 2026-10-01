-- `cobros_forma_pago.acepta_cuotas` no se creó cuando no existía `asociado_terminal`.
-- Cx. Fin. Cobros selecciona esa columna. Default false; true si ya hay filas con cuota.

ALTER TABLE "cobros_forma_pago"
  ADD COLUMN IF NOT EXISTS "acepta_cuotas" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cobros_forma_pago" p
SET "acepta_cuotas" = true
WHERE EXISTS (
  SELECT 1
  FROM "cobros_cx_fin" f
  WHERE f."pago_id" = p."id"
    AND f."cuota_id" IS NOT NULL
);
