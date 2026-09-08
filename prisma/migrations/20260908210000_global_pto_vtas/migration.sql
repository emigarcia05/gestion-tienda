-- Catálogo de puntos de venta DUX y sucursales asociadas (N:M).
CREATE TABLE IF NOT EXISTS "global_pto_vtas" (
  "id" TEXT NOT NULL,
  "pto_venta" INTEGER NOT NULL,
  "nombre_pto_venta" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "global_pto_vtas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "global_pto_vtas_pto_venta_key"
ON "global_pto_vtas" ("pto_venta");

CREATE TABLE IF NOT EXISTS "global_pto_vta_sucursales" (
  "pto_vta_id" TEXT NOT NULL,
  "sucursal_id" TEXT NOT NULL,

  CONSTRAINT "global_pto_vta_sucursales_pkey" PRIMARY KEY ("pto_vta_id", "sucursal_id")
);

CREATE INDEX IF NOT EXISTS "global_pto_vta_sucursales_sucursal_idx"
ON "global_pto_vta_sucursales" ("sucursal_id");

ALTER TABLE "global_pto_vta_sucursales"
  ADD CONSTRAINT "global_pto_vta_sucursales_pto_vta_id_fkey"
  FOREIGN KEY ("pto_vta_id") REFERENCES "global_pto_vtas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "global_pto_vta_sucursales"
  ADD CONSTRAINT "global_pto_vta_sucursales_sucursal_id_fkey"
  FOREIGN KEY ("sucursal_id") REFERENCES "global_sucursales"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
