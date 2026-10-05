-- Unifica transf_depo_ingreso + transf_depo_egreso → transf_interna.
-- El signo sigue en tipo_movimiento (ingreso | egreso).

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
  ADD CONSTRAINT "stock_movimientos_tipo_categoria_chk" CHECK (
    ("categoria_movimiento" = 'venta' AND "tipo_movimiento" = 'egreso')
    OR ("categoria_movimiento" = 'nota_credito' AND "tipo_movimiento" = 'ingreso')
    OR ("categoria_movimiento" = 'compra' AND "tipo_movimiento" = 'ingreso')
    OR ("categoria_movimiento" = 'transf_interna')
    OR ("categoria_movimiento" = 'ajuste_stock')
  );
