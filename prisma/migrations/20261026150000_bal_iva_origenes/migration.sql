-- Balance IVA: cada fila de bal_iva queda atada a un solo origen (venta fiscal, compra de mercadería,
-- gasto o Cx Fin de cobro) y se borra en cascada con él. NC y devoluciones restan en su columna
-- (importe negativo), por eso se reemplaza el CHECK de importes ≥ 0.
-- fin_compras_comprobante.fiscal: la NC de compra no guardaba si era fiscal.

DO $$
BEGIN
  CREATE TYPE "OrigenBalIva" AS ENUM ('VENTA', 'COMPRA_MERCADERIA', 'GASTO', 'CX_FINANCIERO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DELETE FROM "bal_iva" WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'bal_iva' AND column_name = 'origen'
);

ALTER TABLE "bal_iva"
  ADD COLUMN IF NOT EXISTS "origen" "OrigenBalIva" NOT NULL,
  ADD COLUMN IF NOT EXISTS "comprobante_vta_id" TEXT,
  ADD COLUMN IF NOT EXISTS "comprobante_compra_id" TEXT,
  ADD COLUMN IF NOT EXISTS "gasto_mensual_id" TEXT,
  ADD COLUMN IF NOT EXISTS "tesoreria_movimiento_id" TEXT;

ALTER TABLE "bal_iva" DROP CONSTRAINT IF EXISTS "bal_iva_importes_chk";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_una_columna_chk') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_una_columna_chk" CHECK ("debito" = 0 OR "credito" = 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_origen_chk') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_origen_chk" CHECK (
        num_nonnulls("comprobante_vta_id", "comprobante_compra_id", "gasto_mensual_id", "tesoreria_movimiento_id") = 1
        AND (
          ("origen" = 'VENTA' AND "comprobante_vta_id" IS NOT NULL)
          OR ("origen" = 'COMPRA_MERCADERIA' AND "comprobante_compra_id" IS NOT NULL)
          OR ("origen" = 'GASTO' AND "gasto_mensual_id" IS NOT NULL)
          OR ("origen" = 'CX_FINANCIERO' AND "tesoreria_movimiento_id" IS NOT NULL)
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "bal_iva_comprobante_vta_key" ON "bal_iva"("comprobante_vta_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bal_iva_comprobante_compra_key" ON "bal_iva"("comprobante_compra_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bal_iva_gasto_mensual_key" ON "bal_iva"("gasto_mensual_id");
CREATE UNIQUE INDEX IF NOT EXISTS "bal_iva_tesoreria_movimiento_key" ON "bal_iva"("tesoreria_movimiento_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_comprobante_vta_id_fkey') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_comprobante_vta_id_fkey"
      FOREIGN KEY ("comprobante_vta_id") REFERENCES "vtas_comprobantes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_comprobante_compra_id_fkey') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_comprobante_compra_id_fkey"
      FOREIGN KEY ("comprobante_compra_id") REFERENCES "fin_compras_comprobante"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_gasto_mensual_id_fkey') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_gasto_mensual_id_fkey"
      FOREIGN KEY ("gasto_mensual_id") REFERENCES "fin_bal_gasto_mensual"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_iva_tesoreria_movimiento_id_fkey') THEN
    ALTER TABLE "bal_iva"
      ADD CONSTRAINT "bal_iva_tesoreria_movimiento_id_fkey"
      FOREIGN KEY ("tesoreria_movimiento_id") REFERENCES "tesoreria_movimientos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "fin_compras_comprobante"
  ADD COLUMN IF NOT EXISTS "fiscal" BOOLEAN NOT NULL DEFAULT false;

UPDATE "fin_compras_comprobante" SET "fiscal" = true WHERE UPPER("tipo_comp") = 'FACTURA';
