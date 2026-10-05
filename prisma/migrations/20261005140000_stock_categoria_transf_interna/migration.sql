-- Unifica transf_depo_ingreso + transf_depo_egreso → transf_interna.
-- El signo sigue en tipo_movimiento (ingreso | egreso).
-- Constraint original: stock_movimientos_tipo_categoria (sin sufijo _chk).

ALTER TABLE "stock_movimientos"
  DROP CONSTRAINT IF EXISTS "stock_movimientos_tipo_categoria";
ALTER TABLE "stock_movimientos"
  DROP CONSTRAINT IF EXISTS "stock_movimientos_tipo_categoria_chk";

ALTER TABLE "stock_movimientos"
  ALTER COLUMN "categoria_movimiento" TYPE TEXT
  USING (
    CASE
      WHEN "categoria_movimiento"::text IN ('transf_depo_ingreso', 'transf_depo_egreso')
        THEN 'transf_interna'
      ELSE "categoria_movimiento"::text
    END
  );

DROP TYPE IF EXISTS "stock_movimiento_categoria";

CREATE TYPE "stock_movimiento_categoria" AS ENUM (
  'venta',
  'nota_credito',
  'ajuste_stock',
  'transf_interna',
  'compra'
);

ALTER TABLE "stock_movimientos"
  ALTER COLUMN "categoria_movimiento" TYPE "stock_movimiento_categoria"
  USING ("categoria_movimiento"::"stock_movimiento_categoria");

ALTER TABLE "stock_movimientos"
  ADD CONSTRAINT "stock_movimientos_tipo_categoria" CHECK (
    ("categoria_movimiento"::text = 'venta' AND "tipo_movimiento"::text = 'egreso')
    OR ("categoria_movimiento"::text = 'nota_credito' AND "tipo_movimiento"::text = 'ingreso')
    OR ("categoria_movimiento"::text = 'compra' AND "tipo_movimiento"::text = 'ingreso')
    OR ("categoria_movimiento"::text = 'transf_interna')
    OR ("categoria_movimiento"::text = 'ajuste_stock')
  );
