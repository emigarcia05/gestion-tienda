-- Cajas (cuentas bancarias) desde las que se pueden emitir cheques propios (eCheq).
ALTER TABLE "tesoreria_cajas" ADD COLUMN "emite_cheque" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "TipoChequeEmitido" AS ENUM ('ECHEQ');
CREATE TYPE "EstadoChequeEmitido" AS ENUM ('EMITIDO', 'ANULADO');

-- Cheques propios emitidos a proveedores (pago cuenta corriente). Se debitan de la caja en `fecha_pago`.
CREATE TABLE "tesoreria_cheques_emitidos" (
    "id" TEXT NOT NULL,
    "caja_id" TEXT NOT NULL,
    "proveedor_id" TEXT NOT NULL,
    "tipo" "TipoChequeEmitido" NOT NULL DEFAULT 'ECHEQ',
    "numero" TEXT NOT NULL DEFAULT '',
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "estado" "EstadoChequeEmitido" NOT NULL DEFAULT 'EMITIDO',
    "fecha_anulacion" DATE,
    "observacion" TEXT NOT NULL DEFAULT '',
    "personal_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tesoreria_cheques_emitidos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tesoreria_cheques_emitidos_monto_chk" CHECK ("monto" > 0),
    CONSTRAINT "tesoreria_cheques_emitidos_fechas_chk" CHECK ("fecha_pago" >= "fecha_emision")
);

CREATE INDEX "tesoreria_cheques_emitidos_estado_fecha_pago_idx" ON "tesoreria_cheques_emitidos"("estado", "fecha_pago");
CREATE INDEX "tesoreria_cheques_emitidos_caja_idx" ON "tesoreria_cheques_emitidos"("caja_id");
CREATE INDEX "tesoreria_cheques_emitidos_proveedor_idx" ON "tesoreria_cheques_emitidos"("proveedor_id");
CREATE INDEX "tesoreria_cheques_emitidos_personal_idx" ON "tesoreria_cheques_emitidos"("personal_id");

ALTER TABLE "tesoreria_cheques_emitidos" ADD CONSTRAINT "tesoreria_cheques_emitidos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "tesoreria_cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques_emitidos" ADD CONSTRAINT "tesoreria_cheques_emitidos_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques_emitidos" ADD CONSTRAINT "tesoreria_cheques_emitidos_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "usuarios"("id_personal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cuánto canceló el cheque de cada comprobante de compra (para revertir al anular).
CREATE TABLE "tesoreria_cheques_emitidos_imputaciones" (
    "id" TEXT NOT NULL,
    "cheque_emitido_id" TEXT NOT NULL,
    "comprobante_id" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "tesoreria_cheques_emitidos_imputaciones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tesoreria_cheques_emitidos_imputaciones_monto_chk" CHECK ("monto" > 0)
);

CREATE INDEX "tesoreria_cheques_emitidos_imp_cheque_idx" ON "tesoreria_cheques_emitidos_imputaciones"("cheque_emitido_id");
CREATE INDEX "tesoreria_cheques_emitidos_imp_comprobante_idx" ON "tesoreria_cheques_emitidos_imputaciones"("comprobante_id");

ALTER TABLE "tesoreria_cheques_emitidos_imputaciones" ADD CONSTRAINT "tesoreria_cheques_emitidos_imp_cheque_fkey" FOREIGN KEY ("cheque_emitido_id") REFERENCES "tesoreria_cheques_emitidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques_emitidos_imputaciones" ADD CONSTRAINT "tesoreria_cheques_emitidos_imp_comprobante_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "fin_compras_comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Egreso diferido en el ledger ligado al cheque emitido.
ALTER TABLE "tesoreria_movimientos" ADD COLUMN "cheque_emitido_id" TEXT;
CREATE INDEX "tesoreria_movimientos_cheque_emitido_idx" ON "tesoreria_movimientos"("cheque_emitido_id");
ALTER TABLE "tesoreria_movimientos" ADD CONSTRAINT "tesoreria_movimientos_cheque_emitido_id_fkey" FOREIGN KEY ("cheque_emitido_id") REFERENCES "tesoreria_cheques_emitidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
