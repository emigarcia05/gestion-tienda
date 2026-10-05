-- Transferencias entre sucursales con doble confirmación + notificaciones por sucursal.
-- El ledger (`stock_movimientos`) solo se escribe al aceptar (`comprobante_id`).

CREATE TYPE "stock_transferencia_estado" AS ENUM ('pendiente', 'aceptada', 'rechazada', 'cancelada');

CREATE TYPE "notificacion_tipo" AS ENUM ('transf_pendiente', 'transf_aceptada', 'transf_rechazada', 'transf_cancelada');

CREATE TABLE "stock_transferencias" (
    "id" TEXT NOT NULL,
    "sucursal_origen" TEXT NOT NULL,
    "sucursal_destino" TEXT NOT NULL,
    "sucursal_confirma" TEXT NOT NULL,
    "estado" "stock_transferencia_estado" NOT NULL DEFAULT 'pendiente',
    "creada_por" INTEGER NOT NULL,
    "resuelta_por" INTEGER,
    "motivo" TEXT,
    "comprobante_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_at" TIMESTAMP(3),

    CONSTRAINT "stock_transferencias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_transferencias_origen_destino_chk" CHECK ("sucursal_origen" <> "sucursal_destino"),
    CONSTRAINT "stock_transferencias_confirma_chk" CHECK ("sucursal_confirma" IN ("sucursal_origen", "sucursal_destino")),
    CONSTRAINT "stock_transferencias_aceptada_comprobante_chk" CHECK (
      ("estado" = 'aceptada') = ("comprobante_id" IS NOT NULL)
    )
);

CREATE TABLE "stock_transferencias_items" (
    "id" TEXT NOT NULL,
    "transferencia_id" TEXT NOT NULL,
    "cod_item" TEXT NOT NULL,
    "cantidad" DECIMAL(12,1) NOT NULL,
    "cantidad_confirmada" DECIMAL(12,1),

    CONSTRAINT "stock_transferencias_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_transferencias_items_cantidad_chk" CHECK ("cantidad" > 0),
    CONSTRAINT "stock_transferencias_items_confirmada_chk" CHECK (
      "cantidad_confirmada" IS NULL OR ("cantidad_confirmada" >= 0 AND "cantidad_confirmada" <= "cantidad")
    )
);

CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "tipo" "notificacion_tipo" NOT NULL,
    "sucursal" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "transferencia_id" TEXT,
    "leida_at" TIMESTAMP(3),
    "leida_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_transferencias_comprobante_key" ON "stock_transferencias"("comprobante_id");
CREATE INDEX "stock_transferencias_confirma_estado_idx" ON "stock_transferencias"("sucursal_confirma", "estado");
CREATE INDEX "stock_transferencias_estado_fecha_idx" ON "stock_transferencias"("estado", "created_at");
CREATE UNIQUE INDEX "stock_transferencias_items_transf_item_key" ON "stock_transferencias_items"("transferencia_id", "cod_item");
CREATE INDEX "notificaciones_sucursal_leida_fecha_idx" ON "notificaciones"("sucursal", "leida_at", "created_at");
CREATE INDEX "notificaciones_transferencia_idx" ON "notificaciones"("transferencia_id");

ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_sucursal_origen_fkey" FOREIGN KEY ("sucursal_origen") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_sucursal_destino_fkey" FOREIGN KEY ("sucursal_destino") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_sucursal_confirma_fkey" FOREIGN KEY ("sucursal_confirma") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "usuarios"("id_personal") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_resuelta_por_fkey" FOREIGN KEY ("resuelta_por") REFERENCES "usuarios"("id_personal") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias" ADD CONSTRAINT "stock_transferencias_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "stock_comprobantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias_items" ADD CONSTRAINT "stock_transferencias_items_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "stock_transferencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transferencias_items" ADD CONSTRAINT "stock_transferencias_items_cod_item_fkey" FOREIGN KEY ("cod_item") REFERENCES "prod_tienda"("cod_tienda") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_sucursal_fkey" FOREIGN KEY ("sucursal") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "stock_transferencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_leida_por_fkey" FOREIGN KEY ("leida_por") REFERENCES "usuarios"("id_personal") ON DELETE SET NULL ON UPDATE CASCADE;
