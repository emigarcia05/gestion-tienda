-- Punto de venta por sucursal × grupo de factura (A = receptor RI; BC = resto).
-- FK compuesta a pto_vta_sucursales: si el pto. vta. deja de estar asociado a la sucursal, la fila se borra.
CREATE TABLE "sucursal_ptos_vtas_factura" (
    "sucursal_id" TEXT NOT NULL,
    "grupo" VARCHAR(2) NOT NULL,
    "pto_vta_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sucursal_ptos_vtas_factura_pkey" PRIMARY KEY ("sucursal_id", "grupo"),
    CONSTRAINT "sucursal_ptos_vtas_factura_grupo_check" CHECK ("grupo" IN ('A', 'BC'))
);

CREATE INDEX "sucursal_ptos_vtas_factura_pto_vta_idx" ON "sucursal_ptos_vtas_factura"("pto_vta_id", "sucursal_id");

ALTER TABLE "sucursal_ptos_vtas_factura"
    ADD CONSTRAINT "sucursal_ptos_vtas_factura_vinculo_fkey"
    FOREIGN KEY ("pto_vta_id", "sucursal_id")
    REFERENCES "pto_vta_sucursales"("pto_vta_id", "sucursal_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
