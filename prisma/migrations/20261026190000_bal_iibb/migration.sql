-- Balance IIBB: libro con una fila por movimiento que genera IIBB débito (solo débito, sin crédito).
-- VENTA: factura / NC fiscal autorizada de un punto de venta RI → débito = (total / 1,21) × 4 %
-- (NC en negativo), atada al comprobante (Cascade). AJUSTE: fila manual sin origen (suma o resta).
-- Arranca vacío (sin backfill), igual que bal_iva.

DO $$
BEGIN
  CREATE TYPE "OrigenBalIibb" AS ENUM ('VENTA', 'AJUSTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bal_iibb" (
  "id" TEXT NOT NULL,
  "origen" "OrigenBalIibb" NOT NULL,
  "fecha" DATE NOT NULL,
  "descripcion" VARCHAR(255) NOT NULL,
  "debito" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "comprobante_vta_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bal_iibb_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bal_iibb_origen_chk" CHECK (
    ("origen" = 'VENTA' AND "comprobante_vta_id" IS NOT NULL)
    OR ("origen" = 'AJUSTE' AND "comprobante_vta_id" IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "bal_iibb_comprobante_vta_key" ON "bal_iibb"("comprobante_vta_id");
CREATE INDEX IF NOT EXISTS "bal_iibb_fecha_idx" ON "bal_iibb"("fecha");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iibb_comprobante_vta_id_fkey') THEN
    ALTER TABLE "bal_iibb"
      ADD CONSTRAINT "bal_iibb_comprobante_vta_id_fkey"
      FOREIGN KEY ("comprobante_vta_id") REFERENCES "vtas_comprobantes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
