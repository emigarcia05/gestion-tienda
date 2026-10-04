-- Cada sucursal es depósito. Se elimina stock_depositos.
-- Ledger: stock_comprobantes (justificante) + stock_movimientos.

DROP TABLE IF EXISTS "stock_depositos";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movimiento_tipo') THEN
    CREATE TYPE "stock_movimiento_tipo" AS ENUM ('ingreso', 'egreso');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movimiento_categoria') THEN
    CREATE TYPE "stock_movimiento_categoria" AS ENUM (
      'venta',
      'nota_credito',
      'ajuste_stock',
      'transf_depo_ingreso',
      'transf_depo_egreso',
      'compra'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_comprobante_tipo') THEN
    CREATE TYPE "stock_comprobante_tipo" AS ENUM (
      'venta',
      'nota_credito',
      'compra',
      'ajuste_stock',
      'transferencia_entre_depositos'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "stock_comprobantes" (
    "id" TEXT NOT NULL,
    "tipo" "stock_comprobante_tipo" NOT NULL,
    "sucursal" TEXT NOT NULL,
    "sucursal_destino" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_comprobantes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stock_comprobantes_sucursal_idx"
    ON "stock_comprobantes"("sucursal");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_sucursal_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_sucursal_fkey"
      FOREIGN KEY ("sucursal") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_sucursal_destino_fkey'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_sucursal_destino_fkey"
      FOREIGN KEY ("sucursal_destino") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "stock_movimientos" (
    "id" TEXT NOT NULL,
    "tipo_movimiento" "stock_movimiento_tipo" NOT NULL,
    "categoria_movimiento" "stock_movimiento_categoria" NOT NULL,
    "cod_item" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "comprobante_relacionado" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stock_movimientos_item_sucursal_idx"
    ON "stock_movimientos"("cod_item", "sucursal");
CREATE INDEX IF NOT EXISTS "stock_movimientos_comprobante_idx"
    ON "stock_movimientos"("comprobante_relacionado");
CREATE INDEX IF NOT EXISTS "stock_movimientos_sucursal_fecha_idx"
    ON "stock_movimientos"("sucursal", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_cod_item_fkey'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_cod_item_fkey"
      FOREIGN KEY ("cod_item") REFERENCES "prod_tienda"("cod_tienda")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_sucursal_fkey'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_sucursal_fkey"
      FOREIGN KEY ("sucursal") REFERENCES "sucursales"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_comprobante_relacionado_fkey'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_comprobante_relacionado_fkey"
      FOREIGN KEY ("comprobante_relacionado") REFERENCES "stock_comprobantes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_cantidad_positiva'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_cantidad_positiva"
      CHECK ("cantidad" > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_comprobantes_destino_chk'
  ) THEN
    ALTER TABLE "stock_comprobantes"
      ADD CONSTRAINT "stock_comprobantes_destino_chk"
      CHECK (
        (
          "tipo" = 'transferencia_entre_depositos'
          AND "sucursal_destino" IS NOT NULL
          AND "sucursal_destino" <> "sucursal"
        )
        OR (
          "tipo" <> 'transferencia_entre_depositos'
          AND "sucursal_destino" IS NULL
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movimientos_tipo_categoria'
  ) THEN
    ALTER TABLE "stock_movimientos"
      ADD CONSTRAINT "stock_movimientos_tipo_categoria"
      CHECK (
        ("categoria_movimiento" = 'venta' AND "tipo_movimiento" = 'egreso')
        OR ("categoria_movimiento" = 'nota_credito' AND "tipo_movimiento" = 'ingreso')
        OR ("categoria_movimiento" = 'compra' AND "tipo_movimiento" = 'ingreso')
        OR ("categoria_movimiento" = 'transf_depo_ingreso' AND "tipo_movimiento" = 'ingreso')
        OR ("categoria_movimiento" = 'transf_depo_egreso' AND "tipo_movimiento" = 'egreso')
        OR ("categoria_movimiento" = 'ajuste_stock')
      );
  END IF;
END $$;
