-- tesoreria_movimientos: sentido (ingreso/egreso) aparte de la categoría.
-- monto siempre positivo. Datos de cobro solo en COBRO y NOTA_CREDITO.
-- sucursal_id pasa a ser obligatoria (sucursal del movimiento).

CREATE TYPE "SentidoMovimientoTesoreria" AS ENUM ('INGRESO', 'EGRESO');

CREATE TYPE "CategoriaMovimientoTesoreria" AS ENUM (
  'COBRO',
  'NOTA_CREDITO',
  'PAGO_PROVEEDOR',
  'PAGO_GASTOS',
  'AJUSTE_CAJA',
  'TRANSFERENCIA_ENTRE_CAJAS'
);

ALTER TABLE "tesoreria_movimientos"
  ADD COLUMN "tipo_movimiento" "SentidoMovimientoTesoreria",
  ADD COLUMN "cat_movimiento" "CategoriaMovimientoTesoreria",
  ADD COLUMN "pago_id" TEXT,
  ADD COLUMN "entidad_id" TEXT,
  ADD COLUMN "cuota_id" TEXT,
  ADD COLUMN "cx_fin_id" TEXT;

-- Filas previas: el signo de monto define el sentido. PERSONAL y OTRO
-- quedan como PAGO_GASTOS (el catálogo ya no los distingue).
UPDATE "tesoreria_movimientos"
SET
  "tipo_movimiento" = CASE
    WHEN "tipo" = 'COBRO' THEN 'INGRESO'::"SentidoMovimientoTesoreria"
    WHEN "tipo" = 'NOTA_CREDITO_VENTA' THEN 'EGRESO'::"SentidoMovimientoTesoreria"
    WHEN "tipo" = 'PAGO' THEN 'EGRESO'::"SentidoMovimientoTesoreria"
    WHEN "tipo" = 'ARQUEO' AND "monto" > 0 THEN 'INGRESO'::"SentidoMovimientoTesoreria"
    WHEN "tipo" = 'ARQUEO' THEN 'EGRESO'::"SentidoMovimientoTesoreria"
    WHEN "tipo" = 'TRANSFERENCIA_ENTRE_CAJAS' AND "monto" > 0 THEN 'INGRESO'::"SentidoMovimientoTesoreria"
    ELSE 'EGRESO'::"SentidoMovimientoTesoreria"
  END,
  "cat_movimiento" = CASE
    WHEN "tipo" = 'COBRO' THEN 'COBRO'::"CategoriaMovimientoTesoreria"
    WHEN "tipo" = 'NOTA_CREDITO_VENTA' THEN 'NOTA_CREDITO'::"CategoriaMovimientoTesoreria"
    WHEN "tipo" = 'PAGO' AND "categoria_pago" = 'PROVEEDOR' THEN 'PAGO_PROVEEDOR'::"CategoriaMovimientoTesoreria"
    WHEN "tipo" = 'PAGO' THEN 'PAGO_GASTOS'::"CategoriaMovimientoTesoreria"
    WHEN "tipo" = 'ARQUEO' THEN 'AJUSTE_CAJA'::"CategoriaMovimientoTesoreria"
    ELSE 'TRANSFERENCIA_ENTRE_CAJAS'::"CategoriaMovimientoTesoreria"
  END,
  "monto" = ABS("monto");

UPDATE "tesoreria_movimientos" AS m
SET "sucursal_id" = c."sucursal_id"
FROM "tesoreria_cajas" AS c
WHERE m."sucursal_id" IS NULL
  AND m."caja_id" = c."id"
  AND c."sucursal_id" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "tesoreria_movimientos" WHERE "sucursal_id" IS NULL) THEN
    RAISE EXCEPTION 'tesoreria_movimientos tiene filas sin sucursal y la caja tampoco tiene sucursal';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "tesoreria_movimientos"
    WHERE "tipo_movimiento" IS NULL OR "cat_movimiento" IS NULL
  ) THEN
    RAISE EXCEPTION 'tesoreria_movimientos no pudo clasificar filas existentes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "tesoreria_movimientos"
    WHERE "cat_movimiento" IN ('COBRO', 'NOTA_CREDITO')
      AND "pago_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Hay cobros o notas de crédito sin forma de pago; no se puede exigir pago_id';
  END IF;
END $$;

ALTER TABLE "tesoreria_movimientos"
  DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_monto_chk",
  DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_pago_categoria_chk",
  DROP CONSTRAINT IF EXISTS "tesoreria_movimientos_transferencia_chk";

DROP INDEX IF EXISTS "tesoreria_movimientos_tipo_idx";
DROP INDEX IF EXISTS "tesoreria_movimientos_categoria_pago_idx";

ALTER TABLE "tesoreria_movimientos"
  DROP COLUMN "tipo",
  DROP COLUMN "categoria_pago";

DROP TYPE "TipoMovimientoTesoreria";
DROP TYPE "CategoriaPagoTesoreria";

ALTER TABLE "tesoreria_movimientos"
  ALTER COLUMN "tipo_movimiento" SET NOT NULL,
  ALTER COLUMN "cat_movimiento" SET NOT NULL,
  ALTER COLUMN "sucursal_id" SET NOT NULL;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_monto_chk" CHECK ("monto" > 0),
  ADD CONSTRAINT "tesoreria_movimientos_sentido_chk" CHECK (
    ("cat_movimiento" = 'COBRO' AND "tipo_movimiento" = 'INGRESO')
    OR ("cat_movimiento" = 'NOTA_CREDITO' AND "tipo_movimiento" = 'EGRESO')
    OR ("cat_movimiento" = 'PAGO_PROVEEDOR' AND "tipo_movimiento" = 'EGRESO')
    OR ("cat_movimiento" = 'PAGO_GASTOS' AND "tipo_movimiento" = 'EGRESO')
    OR ("cat_movimiento" IN ('AJUSTE_CAJA', 'TRANSFERENCIA_ENTRE_CAJAS'))
  ),
  ADD CONSTRAINT "tesoreria_movimientos_cobro_chk" CHECK (
    (
      "cat_movimiento" IN ('COBRO', 'NOTA_CREDITO')
      AND "pago_id" IS NOT NULL
    )
    OR (
      "cat_movimiento" NOT IN ('COBRO', 'NOTA_CREDITO')
      AND "pago_id" IS NULL
      AND "entidad_id" IS NULL
      AND "cuota_id" IS NULL
      AND "cx_fin_id" IS NULL
    )
  ),
  ADD CONSTRAINT "tesoreria_movimientos_cuota_entidad_chk" CHECK (
    "cuota_id" IS NULL OR "entidad_id" IS NOT NULL
  ),
  ADD CONSTRAINT "tesoreria_movimientos_transferencia_chk" CHECK (
    (
      "cat_movimiento" = 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NOT NULL
      AND "caja_contraparte_id" IS NOT NULL
      AND "caja_contraparte_id" <> "caja_id"
    )
    OR (
      "cat_movimiento" <> 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NULL
      AND "caja_contraparte_id" IS NULL
    )
  );

CREATE INDEX "tesoreria_movimientos_tipo_movimiento_idx"
  ON "tesoreria_movimientos" ("tipo_movimiento");
CREATE INDEX "tesoreria_movimientos_cat_movimiento_idx"
  ON "tesoreria_movimientos" ("cat_movimiento");
CREATE INDEX "tesoreria_movimientos_pago_idx"
  ON "tesoreria_movimientos" ("pago_id");
CREATE INDEX "tesoreria_movimientos_entidad_idx"
  ON "tesoreria_movimientos" ("entidad_id");
CREATE INDEX "tesoreria_movimientos_cuota_idx"
  ON "tesoreria_movimientos" ("cuota_id");
CREATE INDEX "tesoreria_movimientos_cx_fin_idx"
  ON "tesoreria_movimientos" ("cx_fin_id");

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_pago_id_fkey"
  FOREIGN KEY ("pago_id") REFERENCES "cobros_forma_pago"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_entidad_id_fkey"
  FOREIGN KEY ("entidad_id") REFERENCES "cobros_entidades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_cuota_id_fkey"
  FOREIGN KEY ("cuota_id") REFERENCES "cobros_cuotas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_cx_fin_id_fkey"
  FOREIGN KEY ("cx_fin_id") REFERENCES "cobros_cx_fin"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
