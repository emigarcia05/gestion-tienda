-- cobros_por_sucursal: destino por forma de pago × entidad × sucursal
-- (todas las cuotas de esa combinación comparten la misma caja).

DROP TABLE IF EXISTS "cobros_por_sucursal";

CREATE TABLE "cobros_por_sucursal" (
  "id" TEXT NOT NULL,
  "pago_id" TEXT NOT NULL,
  "entidad_id" TEXT NOT NULL,
  "sucursal_id" TEXT NOT NULL,
  "caja_destino_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cobros_por_sucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cobros_por_sucursal_pago_entidad_sucursal_ux"
  ON "cobros_por_sucursal" ("pago_id", "entidad_id", "sucursal_id");

CREATE INDEX "cobros_por_sucursal_sucursal_idx"
  ON "cobros_por_sucursal" ("sucursal_id");

CREATE INDEX "cobros_por_sucursal_caja_destino_idx"
  ON "cobros_por_sucursal" ("caja_destino_id");

CREATE INDEX "cobros_por_sucursal_entidad_idx"
  ON "cobros_por_sucursal" ("entidad_id");

ALTER TABLE "cobros_por_sucursal"
  ADD CONSTRAINT "cobros_por_sucursal_pago_entidad_fkey"
  FOREIGN KEY ("pago_id", "entidad_id")
  REFERENCES "cobros_forma_pago_entidades" ("pago_id", "entidad_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cobros_por_sucursal"
  ADD CONSTRAINT "cobros_por_sucursal_sucursal_id_fkey"
  FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cobros_por_sucursal"
  ADD CONSTRAINT "cobros_por_sucursal_caja_destino_id_fkey"
  FOREIGN KEY ("caja_destino_id") REFERENCES "tesoreria_cajas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
