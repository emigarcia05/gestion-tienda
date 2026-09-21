-- Ledger de movimientos por caja de tesorería

CREATE TYPE "TipoMovimientoTesoreria" AS ENUM (
  'COBRO',
  'NOTA_CREDITO_VENTA',
  'PAGO',
  'ARQUEO',
  'TRANSFERENCIA_ENTRE_CAJAS'
);

CREATE TYPE "CategoriaPagoTesoreria" AS ENUM (
  'PROVEEDOR',
  'PERSONAL',
  'GASTO',
  'OTRO'
);

CREATE TABLE "tesoreria_movimientos" (
  "id" TEXT NOT NULL,
  "caja_id" TEXT NOT NULL,
  "tipo" "TipoMovimientoTesoreria" NOT NULL,
  "categoria_pago" "CategoriaPagoTesoreria",
  "monto" INTEGER NOT NULL,
  "fecha" DATE NOT NULL,
  "observacion" TEXT NOT NULL DEFAULT '',
  "transferencia_grupo_id" TEXT,
  "caja_contraparte_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tesoreria_movimientos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tesoreria_movimientos_monto_chk" CHECK ("monto" <> 0),
  CONSTRAINT "tesoreria_movimientos_pago_categoria_chk" CHECK (
    ("tipo" = 'PAGO' AND "categoria_pago" IS NOT NULL)
    OR ("tipo" <> 'PAGO' AND "categoria_pago" IS NULL)
  ),
  CONSTRAINT "tesoreria_movimientos_transferencia_chk" CHECK (
    (
      "tipo" = 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NOT NULL
      AND "caja_contraparte_id" IS NOT NULL
      AND "caja_contraparte_id" <> "caja_id"
    )
    OR (
      "tipo" <> 'TRANSFERENCIA_ENTRE_CAJAS'
      AND "transferencia_grupo_id" IS NULL
      AND "caja_contraparte_id" IS NULL
    )
  )
);

CREATE INDEX "tesoreria_movimientos_caja_fecha_idx"
  ON "tesoreria_movimientos" ("caja_id", "fecha");
CREATE INDEX "tesoreria_movimientos_tipo_idx"
  ON "tesoreria_movimientos" ("tipo");
CREATE INDEX "tesoreria_movimientos_fecha_idx"
  ON "tesoreria_movimientos" ("fecha");
CREATE INDEX "tesoreria_movimientos_transferencia_grupo_idx"
  ON "tesoreria_movimientos" ("transferencia_grupo_id");
CREATE INDEX "tesoreria_movimientos_caja_contraparte_idx"
  ON "tesoreria_movimientos" ("caja_contraparte_id");
CREATE INDEX "tesoreria_movimientos_categoria_pago_idx"
  ON "tesoreria_movimientos" ("categoria_pago");

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_caja_id_fkey"
  FOREIGN KEY ("caja_id") REFERENCES "tesoreria_cajas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tesoreria_movimientos"
  ADD CONSTRAINT "tesoreria_movimientos_caja_contraparte_id_fkey"
  FOREIGN KEY ("caja_contraparte_id") REFERENCES "tesoreria_cajas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
