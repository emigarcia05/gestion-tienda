-- Categorías de descuento: BASE (permanente) / FECHA (rango conocido) / STOCK (lote por ítem
-- con cantidad y costo nuevo). El lote valoriza `bal_cx_mercaderia` mientras tenga saldo.

CREATE TYPE "desc_promo_categoria" AS ENUM ('BASE', 'FECHA', 'STOCK');
CREATE TYPE "desc_promo_costo_tipo" AS ENUM ('PORCENTAJE', 'FIJO');

ALTER TABLE "desc_promo"
  ADD COLUMN "categoria" "desc_promo_categoria" NOT NULL DEFAULT 'BASE',
  ADD COLUMN "fecha_desde" DATE,
  ADD COLUMN "fecha_hasta" DATE;

ALTER TABLE "desc_promo" ADD CONSTRAINT "desc_promo_categoria_fechas_chk" CHECK (
  (
    "categoria" = 'FECHA'
    AND "fecha_desde" IS NOT NULL
    AND "fecha_hasta" IS NOT NULL
    AND "fecha_desde" <= "fecha_hasta"
  )
  OR (
    "categoria" <> 'FECHA'
    AND "fecha_desde" IS NULL
    AND "fecha_hasta" IS NULL
  )
);

ALTER TABLE "desc_promo" ADD CONSTRAINT "desc_promo_stock_alcance_chk" CHECK (
  "categoria" <> 'STOCK' OR "alcance" = 'ITEMS'
);

CREATE INDEX "desc_promo_categoria_idx" ON "desc_promo"("categoria");

ALTER TABLE "desc_promo_items"
  ADD COLUMN "cantidad" DECIMAL(12,1),
  ADD COLUMN "cantidad_consumida" DECIMAL(12,1) NOT NULL DEFAULT 0,
  ADD COLUMN "costo_tipo" "desc_promo_costo_tipo",
  ADD COLUMN "costo_valor" DECIMAL(14,4),
  ADD COLUMN "costo_base" DECIMAL(14,4),
  ADD COLUMN "costo_unitario" DECIMAL(14,4);

ALTER TABLE "desc_promo_items" ADD CONSTRAINT "desc_promo_items_lote_chk" CHECK (
  (
    "cantidad" IS NULL
    AND "cantidad_consumida" = 0
    AND "costo_tipo" IS NULL
    AND "costo_valor" IS NULL
    AND "costo_base" IS NULL
    AND "costo_unitario" IS NULL
  )
  OR (
    "cantidad" > 0
    AND "cantidad_consumida" >= 0
    AND "cantidad_consumida" <= "cantidad"
    AND "costo_tipo" IS NOT NULL
    AND "costo_valor" IS NOT NULL
    AND "costo_valor" >= 0
    AND "costo_unitario" IS NOT NULL
    AND "costo_unitario" >= 0
    AND (
      "costo_tipo" = 'FIJO'
      OR ("costo_valor" <= 100 AND "costo_base" IS NOT NULL AND "costo_base" >= 0)
    )
  )
);

-- Una línea de stock puede valorizarse en 2 filas (parte del lote + parte a costo normal).
ALTER TYPE "bal_cx_mercaderia_origen_costo" ADD VALUE IF NOT EXISTS 'desc_stock';

DROP INDEX IF EXISTS "bal_cx_mercaderia_stock_movimiento_key";
CREATE INDEX IF NOT EXISTS "bal_cx_mercaderia_stock_movimiento_idx"
  ON "bal_cx_mercaderia"("stock_movimiento_id");

ALTER TABLE "bal_cx_mercaderia" ADD COLUMN "desc_promo_id" TEXT;

CREATE INDEX "bal_cx_mercaderia_desc_promo_idx"
  ON "bal_cx_mercaderia"("desc_promo_id", "cod_item");

ALTER TABLE "bal_cx_mercaderia"
  ADD CONSTRAINT "bal_cx_mercaderia_desc_promo_id_fkey"
  FOREIGN KEY ("desc_promo_id") REFERENCES "desc_promo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
