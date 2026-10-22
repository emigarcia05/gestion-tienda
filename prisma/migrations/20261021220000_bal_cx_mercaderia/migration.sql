-- Cx. Mercadería Vendida: movimiento de mercadería valorizado por cada línea de stock de venta / NC.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bal_cx_mercaderia_origen_costo') THEN
    CREATE TYPE "bal_cx_mercaderia_origen_costo" AS ENUM (
      'cx_proveedor',
      'manual',
      'compuesto',
      'venta_original',
      'sin_costo'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "bal_cx_mercaderia" (
    "id" TEXT NOT NULL,
    "tipo_movimiento" "stock_movimiento_tipo" NOT NULL,
    "comprobante_vta_id" TEXT NOT NULL,
    "stock_movimiento_id" TEXT NOT NULL,
    "cod_item" TEXT NOT NULL,
    "sucursal_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad" DECIMAL(12,1) NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "costo_total" DECIMAL(14,2) NOT NULL,
    "origen_costo" "bal_cx_mercaderia_origen_costo" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bal_cx_mercaderia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bal_cx_mercaderia_cantidad_chk" CHECK ("cantidad" > 0),
    CONSTRAINT "bal_cx_mercaderia_costo_unitario_chk" CHECK ("costo_unitario" >= 0),
    CONSTRAINT "bal_cx_mercaderia_costo_total_chk" CHECK ("costo_total" >= 0),
    CONSTRAINT "bal_cx_mercaderia_venta_original_chk" CHECK (
      "origen_costo"::text <> 'venta_original' OR "tipo_movimiento"::text = 'ingreso'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "bal_cx_mercaderia_stock_movimiento_key"
    ON "bal_cx_mercaderia"("stock_movimiento_id");
CREATE INDEX IF NOT EXISTS "bal_cx_mercaderia_sucursal_fecha_idx"
    ON "bal_cx_mercaderia"("sucursal_id", "fecha");
CREATE INDEX IF NOT EXISTS "bal_cx_mercaderia_cod_item_idx"
    ON "bal_cx_mercaderia"("cod_item");
CREATE INDEX IF NOT EXISTS "bal_cx_mercaderia_comprobante_vta_idx"
    ON "bal_cx_mercaderia"("comprobante_vta_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_mercaderia_comprobante_vta_id_fkey') THEN
    ALTER TABLE "bal_cx_mercaderia"
      ADD CONSTRAINT "bal_cx_mercaderia_comprobante_vta_id_fkey"
      FOREIGN KEY ("comprobante_vta_id") REFERENCES "vtas_comprobantes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_mercaderia_stock_movimiento_id_fkey') THEN
    ALTER TABLE "bal_cx_mercaderia"
      ADD CONSTRAINT "bal_cx_mercaderia_stock_movimiento_id_fkey"
      FOREIGN KEY ("stock_movimiento_id") REFERENCES "stock_movimientos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_mercaderia_cod_item_fkey') THEN
    ALTER TABLE "bal_cx_mercaderia"
      ADD CONSTRAINT "bal_cx_mercaderia_cod_item_fkey"
      FOREIGN KEY ("cod_item") REFERENCES "prod_lista"("cod_tienda")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bal_cx_mercaderia_sucursal_id_fkey') THEN
    ALTER TABLE "bal_cx_mercaderia"
      ADD CONSTRAINT "bal_cx_mercaderia_sucursal_id_fkey"
      FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
