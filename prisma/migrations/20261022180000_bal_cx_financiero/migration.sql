-- Cx. Financiero de cobros de venta: una fila por cobro (+) / devolución NC (−) de tesorería
-- con comprobante y costo financiero > 0. Sin backfill: se registra desde esta versión.

CREATE TABLE IF NOT EXISTS "bal_cx_financiero" (
    "id" TEXT NOT NULL,
    "tesoreria_movimiento_id" TEXT NOT NULL,
    "tipo_movimiento" "SentidoMovimientoTesoreria" NOT NULL,
    "comprobante_vta_id" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "pago_id" TEXT NOT NULL,
    "entidad_id" TEXT,
    "cuota_id" TEXT,
    "monto_cobrado" INTEGER NOT NULL,
    "costo_pct" DECIMAL(5,2) NOT NULL,
    "cx_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bal_cx_financiero_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bal_cx_financiero_monto_chk" CHECK ("monto_cobrado" > 0),
    CONSTRAINT "bal_cx_financiero_costo_pct_chk" CHECK ("costo_pct" > 0),
    CONSTRAINT "bal_cx_financiero_cx_total_chk" CHECK ("cx_total" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "bal_cx_financiero_tesoreria_movimiento_key"
    ON "bal_cx_financiero"("tesoreria_movimiento_id");
CREATE INDEX IF NOT EXISTS "bal_cx_financiero_sucursal_fecha_idx"
    ON "bal_cx_financiero"("sucursal_id", "fecha");
CREATE INDEX IF NOT EXISTS "bal_cx_financiero_pago_idx"
    ON "bal_cx_financiero"("pago_id");
CREATE INDEX IF NOT EXISTS "bal_cx_financiero_comprobante_vta_idx"
    ON "bal_cx_financiero"("comprobante_vta_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_tesoreria_movimiento_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_tesoreria_movimiento_id_fkey"
      FOREIGN KEY ("tesoreria_movimiento_id") REFERENCES "tesoreria_movimientos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_comprobante_vta_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_comprobante_vta_id_fkey"
      FOREIGN KEY ("comprobante_vta_id") REFERENCES "vtas_comprobantes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_sucursal_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_sucursal_id_fkey"
      FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_pago_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_pago_id_fkey"
      FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_entidad_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_entidad_id_fkey"
      FOREIGN KEY ("entidad_id") REFERENCES "cobros_entidades"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_financiero_cuota_id_fkey') THEN
    ALTER TABLE "bal_cx_financiero"
      ADD CONSTRAINT "bal_cx_financiero_cuota_id_fkey"
      FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
