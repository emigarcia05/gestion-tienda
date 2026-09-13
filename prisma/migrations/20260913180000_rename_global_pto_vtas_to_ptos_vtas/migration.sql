-- Renombra `global_pto_vtas` → `ptos_vtas` y amplía el catálogo fiscal.
-- PK `id` (TEXT/cuid) se conserva: no es serial; las FKs existentes apuntan a ese id.

ALTER TABLE "global_pto_vtas" RENAME TO "ptos_vtas";

ALTER INDEX IF EXISTS "global_pto_vtas_pto_venta_key" RENAME TO "ptos_vtas_pto_venta_key";

ALTER TABLE "ptos_vtas" RENAME CONSTRAINT "global_pto_vtas_pkey" TO "ptos_vtas_pkey";

-- `pto_venta`: entero → CHAR(5) con relleno de ceros (ej. 2 → '00002').
ALTER TABLE "ptos_vtas"
  ALTER COLUMN "pto_venta" TYPE CHAR(5)
  USING lpad("pto_venta"::text, 5, '0');

ALTER TABLE "ptos_vtas"
  ADD COLUMN IF NOT EXISTS "cuit" VARCHAR(11),
  ADD COLUMN IF NOT EXISTS "ii_bb_multilateral" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ii_bb" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "condicion_iva" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "domicilio_comercial" TEXT,
  ADD COLUMN IF NOT EXISTS "inicio_actividades" DATE,
  ADD COLUMN IF NOT EXISTS "concepto" VARCHAR(8) NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS "estado" VARCHAR(16) NOT NULL DEFAULT 'activo';

-- CUIT: exactamente 11 dígitos sin guiones (NULL permitido en filas legacy).
ALTER TABLE "ptos_vtas"
  DROP CONSTRAINT IF EXISTS "ptos_vtas_cuit_check";
ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_cuit_check"
  CHECK ("cuit" IS NULL OR "cuit" ~ '^[0-9]{11}$');

-- Punto de venta: exactamente 5 dígitos.
ALTER TABLE "ptos_vtas"
  DROP CONSTRAINT IF EXISTS "ptos_vtas_pto_venta_check";
ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_pto_venta_check"
  CHECK ("pto_venta" ~ '^[0-9]{5}$');

ALTER TABLE "ptos_vtas"
  DROP CONSTRAINT IF EXISTS "ptos_vtas_condicion_iva_check";
ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_condicion_iva_check"
  CHECK (
    "condicion_iva" IS NULL
    OR "condicion_iva" IN ('Responsable Inscripto', 'Monotributista')
  );

ALTER TABLE "ptos_vtas"
  DROP CONSTRAINT IF EXISTS "ptos_vtas_estado_check";
ALTER TABLE "ptos_vtas"
  ADD CONSTRAINT "ptos_vtas_estado_check"
  CHECK ("estado" IN ('activo', 'inactivo'));
