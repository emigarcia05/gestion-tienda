-- Rename matriz Cx. Fin. + catálogo de destinos por sucursal.

ALTER TABLE IF EXISTS "fin_ana_cos_fina" RENAME TO "cobros_cx_fin";

ALTER INDEX IF EXISTS "fin_ana_cos_fina_terminal_idx" RENAME TO "cobros_cx_fin_terminal_idx";
ALTER INDEX IF EXISTS "fin_ana_cos_fina_pago_idx" RENAME TO "cobros_cx_fin_pago_idx";
ALTER INDEX IF EXISTS "fin_ana_cos_fina_cuota_idx" RENAME TO "cobros_cx_fin_cuota_idx";
ALTER INDEX IF EXISTS "fin_ana_cos_fina_terminal_pago_cuota_ux" RENAME TO "cobros_cx_fin_terminal_pago_cuota_ux";
ALTER INDEX IF EXISTS "fin_ana_cos_fina_terminal_pago_sin_cuota_ux" RENAME TO "cobros_cx_fin_terminal_pago_sin_cuota_ux";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_ana_cos_fina_cuota_id_fkey'
  ) THEN
    ALTER TABLE "cobros_cx_fin" RENAME CONSTRAINT "fin_ana_cos_fina_cuota_id_fkey" TO "cobros_cx_fin_cuota_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_ana_cos_fina_pago_id_fkey'
  ) THEN
    ALTER TABLE "cobros_cx_fin" RENAME CONSTRAINT "fin_ana_cos_fina_pago_id_fkey" TO "cobros_cx_fin_pago_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fin_ana_cos_fina_terminal_id_fkey'
  ) THEN
    ALTER TABLE "cobros_cx_fin" RENAME CONSTRAINT "fin_ana_cos_fina_terminal_id_fkey" TO "cobros_cx_fin_terminal_id_fkey";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "cobros_por_sucursal" (
  "id" TEXT NOT NULL,
  "cobros_cx_fin_id" TEXT NOT NULL,
  "sucursal_id" TEXT NOT NULL,
  "caja_destino_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cobros_por_sucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cobros_por_sucursal_cx_fin_sucursal_ux"
  ON "cobros_por_sucursal" ("cobros_cx_fin_id", "sucursal_id");

CREATE INDEX IF NOT EXISTS "cobros_por_sucursal_sucursal_idx"
  ON "cobros_por_sucursal" ("sucursal_id");

CREATE INDEX IF NOT EXISTS "cobros_por_sucursal_caja_destino_idx"
  ON "cobros_por_sucursal" ("caja_destino_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_cobros_cx_fin_id_fkey'
  ) THEN
    ALTER TABLE "cobros_por_sucursal"
      ADD CONSTRAINT "cobros_por_sucursal_cobros_cx_fin_id_fkey"
      FOREIGN KEY ("cobros_cx_fin_id") REFERENCES "cobros_cx_fin"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_sucursal_id_fkey'
  ) THEN
    ALTER TABLE "cobros_por_sucursal"
      ADD CONSTRAINT "cobros_por_sucursal_sucursal_id_fkey"
      FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_por_sucursal_caja_destino_id_fkey'
  ) THEN
    ALTER TABLE "cobros_por_sucursal"
      ADD CONSTRAINT "cobros_por_sucursal_caja_destino_id_fkey"
      FOREIGN KEY ("caja_destino_id") REFERENCES "tesoreria_cajas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
