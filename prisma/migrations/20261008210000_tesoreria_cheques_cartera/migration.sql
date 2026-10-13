-- Cartera de cheques físicos: cada cobro a una caja CHEQUE crea un cheque EN_CARTERA.
-- Salidas: DEPOSITADO (transferencia a caja propia) o ENTREGADO_PROVEEDOR (pago FIFO a un proveedor).

DROP TYPE IF EXISTS "TipoChequeTesoreria";
DROP TYPE IF EXISTS "TenenciaChequeTesoreria";

CREATE TYPE "EstadoChequeTesoreria" AS ENUM ('EN_CARTERA', 'DEPOSITADO', 'ENTREGADO_PROVEEDOR');

CREATE TABLE "tesoreria_cheques" (
    "id" TEXT NOT NULL,
    "caja_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "monto_acreditado" INTEGER NOT NULL,
    "fecha_recepcion" DATE NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "cliente_id" TEXT,
    "cliente_nombre" TEXT NOT NULL DEFAULT '',
    "comprobante_id" TEXT,
    "cliente_cobro_id" TEXT,
    "estado" "EstadoChequeTesoreria" NOT NULL DEFAULT 'EN_CARTERA',
    "fecha_salida" DATE,
    "caja_destino_id" TEXT,
    "proveedor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tesoreria_cheques_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tesoreria_cheques_monto_check" CHECK ("monto" > 0 AND "monto_acreditado" >= 0)
);

CREATE INDEX "tesoreria_cheques_estado_fecha_pago_idx" ON "tesoreria_cheques"("estado", "fecha_pago");
CREATE INDEX "tesoreria_cheques_caja_idx" ON "tesoreria_cheques"("caja_id");
CREATE INDEX "tesoreria_cheques_cliente_idx" ON "tesoreria_cheques"("cliente_id");
CREATE INDEX "tesoreria_cheques_comprobante_idx" ON "tesoreria_cheques"("comprobante_id");
CREATE INDEX "tesoreria_cheques_cliente_cobro_idx" ON "tesoreria_cheques"("cliente_cobro_id");
CREATE INDEX "tesoreria_cheques_caja_destino_idx" ON "tesoreria_cheques"("caja_destino_id");
CREATE INDEX "tesoreria_cheques_proveedor_idx" ON "tesoreria_cheques"("proveedor_id");

ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "tesoreria_cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "vtas_comprobantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_cliente_cobro_id_fkey" FOREIGN KEY ("cliente_cobro_id") REFERENCES "clientes_cobros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_caja_destino_id_fkey" FOREIGN KEY ("caja_destino_id") REFERENCES "tesoreria_cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tesoreria_cheques" ADD CONSTRAINT "tesoreria_cheques_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tesoreria_movimientos" ADD COLUMN "cheque_id" TEXT;
CREATE INDEX "tesoreria_movimientos_cheque_idx" ON "tesoreria_movimientos"("cheque_id");
ALTER TABLE "tesoreria_movimientos" ADD CONSTRAINT "tesoreria_movimientos_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "tesoreria_cheques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
